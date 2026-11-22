/** Authoritative 20 Hz overworld simulation state. */
import {
  DAY_DURATION_SECONDS, DEFAULT_APPEARANCE, HOTBAR_SLOT_COUNT, WorldChunkCache, resolveMovement,
  sanitizeCharacterAppearance, wrapDayPhase,
  type ArmorSlotKey, type CharacterAppearance, type InventorySnapshot, type PlayerInventoryState, type PlayerSnapshot,
} from "@dc2d/engine";
import {
  buildInventorySnapshot, craftPlayerRecipe, createStarterInventory, equipPlayerArmor,
  isPlayerNearCampfire, movePlayerInventorySlot, unequipPlayerArmor,
} from "./playerInventory.js";

export const TICK_RATE = 20;
export const PLAYER_SPEED_TILES_PER_SEC = 5.4;
export const PLAYER_RADIUS = 0.28;
export const INITIAL_DAY_PHASE = 0.62;

interface SimPlayer {
  readonly id: string;
  name: string;
  appearance: CharacterAppearance;
  x: number;
  y: number;
  elevation: number;
  facingX: number;
  facingY: number;
  aimX: number;
  aimY: number;
  hasExplicitAim: boolean;
  moveX: number;
  moveY: number;
  moving: boolean;
  torchLit: boolean;
  inWater: boolean;
  lastAckSeq: number;
  lastActionAckSeq: number;
  selectedHotbar: number;
  inventory: PlayerInventoryState;
}

export class WorldSim {
  readonly cache: WorldChunkCache;
  private readonly players = new Map<string, SimPlayer>();
  private nextPlayerNum = 1;
  tick = 0;
  dayPhase = INITIAL_DAY_PHASE;
  dayPaused = false;

  constructor(readonly worldSeed = 1337) {
    this.cache = new WorldChunkCache(worldSeed);
    this.cache.getChunk(0, 0);
  }

  addPlayer(name: string, appearance: CharacterAppearance = DEFAULT_APPEARANCE): string {
    const id = `p${this.nextPlayerNum++}`;
    const offset = ((this.players.size % 4) - 1.5) * 0.6;
    this.players.set(id, {
      id, name, appearance: sanitizeCharacterAppearance(appearance),
      x: 0.5 + offset, y: 0.5, elevation: 0, facingX: 0, facingY: 1, aimX: 0, aimY: 1, hasExplicitAim: false,
      moveX: 0, moveY: 0, moving: false, torchLit: true, inWater: false, lastAckSeq: 0, lastActionAckSeq: 0,
      selectedHotbar: 0, inventory: createStarterInventory(),
    });
    return id;
  }

  removePlayer(playerId: string): void { this.players.delete(playerId); }
  setPlayerName(playerId: string, name: string): void { const p = this.players.get(playerId); if (p) p.name = name; }

  setAppearance(playerId: string, req: { readonly name?: string | undefined; readonly appearance: CharacterAppearance }): void {
    const p = this.players.get(playerId);
    if (!p) return;
    if (req.name) p.name = req.name.trim().slice(0, 24) || p.name;
    p.appearance = sanitizeCharacterAppearance(req.appearance);
  }

  queueInput(playerId: string, input: {
    readonly seq: number; readonly moveX: number; readonly moveY: number;
    readonly aimX?: number | undefined; readonly aimY?: number | undefined;
  }): void {
    const p = this.players.get(playerId);
    if (!p) return;
    p.moveX = input.moveX;
    p.moveY = input.moveY;
    p.lastAckSeq = input.seq;
    applyAimInput(p, input);
  }

  toggleTorch(playerId: string): void { const p = this.players.get(playerId); if (p) p.torchLit = !p.torchLit; }
  setDayPhase(dayPhase: number, paused?: boolean): void { this.dayPhase = wrapDayPhase(dayPhase); if (paused !== undefined) this.dayPaused = paused; }
  ackActionSeq(playerId: string, seq?: number): void { const p = this.players.get(playerId); if (p && seq !== undefined) p.lastActionAckSeq = Math.max(p.lastActionAckSeq, seq); }
  actionAckSeq(playerId: string): number { return this.players.get(playerId)?.lastActionAckSeq ?? 0; }
  selectHotbar(playerId: string, slot: number): void { const p = this.players.get(playerId); if (p && slot >= 0 && slot < HOTBAR_SLOT_COUNT) p.selectedHotbar = slot; }
  moveSlot(playerId: string, move: { readonly from: number; readonly to: number }): void { const p = this.players.get(playerId); if (p) movePlayerInventorySlot(p.inventory, move); }

  equipArmor(playerId: string, req: { readonly slotIndex: number; readonly targetArmor?: ArmorSlotKey | undefined }): void {
    const p = this.players.get(playerId);
    if (!p) return;
    const updated = equipPlayerArmor(p.inventory, req);
    if (updated) p.inventory = updated;
  }

  unequipArmor(playerId: string, req: { readonly armorSlot: ArmorSlotKey; readonly targetSlot?: number | undefined }): void {
    const p = this.players.get(playerId);
    if (!p) return;
    const updated = unequipPlayerArmor(p.inventory, req);
    if (updated) p.inventory = updated;
  }

  craftRecipe(playerId: string, recipeId: string): boolean {
    const p = this.players.get(playerId);
    if (!p) return false;
    const updated = craftPlayerRecipe(p.inventory, { recipeId, nearCampfire: isPlayerNearCampfire(this.cache, p.x, p.y) });
    if (!updated) return false;
    p.inventory = updated;
    return true;
  }

  inventorySnapshot(playerId: string): InventorySnapshot | undefined {
    const p = this.players.get(playerId);
    if (!p) return undefined;
    return buildInventorySnapshot({ state: p.inventory, selectedHotbar: p.selectedHotbar, nearCampfire: isPlayerNearCampfire(this.cache, p.x, p.y), ackSeq: p.lastActionAckSeq });
  }

  step(dtSeconds = 1 / TICK_RATE): void {
    this.tick += 1;
    if (!this.dayPaused) this.dayPhase = wrapDayPhase(this.dayPhase + dtSeconds / DAY_DURATION_SECONDS);
    for (const p of this.players.values()) this.stepPlayer(p, dtSeconds);
  }

  private stepPlayer(p: SimPlayer, dtSeconds: number): void {
    const mag = Math.hypot(p.moveX, p.moveY);
    if (mag < 0.05) { p.moving = false; return; }
    const nx = p.moveX / Math.max(1, mag);
    const ny = p.moveY / Math.max(1, mag);
    if (!p.hasExplicitAim) setPlayerAim(p, nx, ny);
    p.moving = true;
    const step = PLAYER_SPEED_TILES_PER_SEC * dtSeconds;
    const res = resolveMovement({ cache: this.cache, x: p.x, y: p.y, dx: nx * step, dy: ny * step, radius: PLAYER_RADIUS, elevation: p.elevation });
    p.x = res.x;
    p.y = res.y;
    p.elevation = res.elevation;
    p.inWater = res.inWater;
  }

  snapshots(): PlayerSnapshot[] {
    return Array.from(this.players.values(), (p) => ({
      id: p.id, name: p.name, x: p.x, y: p.y, elevation: p.elevation,
      facingX: p.facingX, facingY: p.facingY, aimX: p.aimX, aimY: p.aimY,
      moving: p.moving, torchLit: p.torchLit, inWater: p.inWater, lastAckSeq: p.lastAckSeq,
      heldItem: p.inventory.slots[p.selectedHotbar]?.itemId ?? null,
      appearance: p.appearance, armor: { ...p.inventory.armor },
    }));
  }
}

function setPlayerAim(p: SimPlayer, ax: number, ay: number): void {
  p.aimX = ax;
  p.aimY = ay;
  p.facingX = ax;
  p.facingY = ay;
}

function applyAimInput(p: SimPlayer, input: { readonly aimX?: number | undefined; readonly aimY?: number | undefined }): void {
  if (input.aimX === undefined || input.aimY === undefined) { p.hasExplicitAim = false; return; }
  const mag = Math.hypot(input.aimX, input.aimY);
  if (mag <= 0.05) { p.hasExplicitAim = false; return; }
  setPlayerAim(p, input.aimX / mag, input.aimY / mag);
  p.hasExplicitAim = true;
}
