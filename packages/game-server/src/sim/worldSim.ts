/** Authoritative 20 Hz overworld simulation state. */
import {
  DAY_DURATION_SECONDS, HOTBAR_SLOT_COUNT, WorldChunkCache, resolveMovement, wrapDayPhase,
  type ArmorSlotKey, type InventorySnapshot, type PlayerInventoryState, type PlayerSnapshot,
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
  readonly name: string;
  x: number;
  y: number;
  elevation: number;
  facingX: number;
  facingY: number;
  moveX: number;
  moveY: number;
  moving: boolean;
  torchLit: boolean;
  inWater: boolean;
  lastAckSeq: number;
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

  addPlayer(name: string): string {
    const id = `p${this.nextPlayerNum++}`;
    const offset = ((this.players.size % 4) - 1.5) * 0.6;
    this.players.set(id, {
      id, name, x: 0.5 + offset, y: 0.5, elevation: 0, facingX: 0, facingY: 1,
      moveX: 0, moveY: 0, moving: false, torchLit: true, inWater: false, lastAckSeq: 0,
      selectedHotbar: 0, inventory: createStarterInventory(),
    });
    return id;
  }

  removePlayer(playerId: string): void {
    this.players.delete(playerId);
  }

  setPlayerName(playerId: string, name: string): void {
    const player = this.players.get(playerId);
    if (!player) return;
    this.players.set(playerId, { ...player, name });
  }

  queueInput(playerId: string, input: { readonly seq: number; readonly moveX: number; readonly moveY: number }): void {
    const player = this.players.get(playerId);
    if (!player) return;
    player.moveX = input.moveX;
    player.moveY = input.moveY;
    player.lastAckSeq = input.seq;
  }

  toggleTorch(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) player.torchLit = !player.torchLit;
  }

  setDayPhase(dayPhase: number, paused?: boolean): void {
    this.dayPhase = wrapDayPhase(dayPhase);
    if (paused !== undefined) this.dayPaused = paused;
  }

  selectHotbar(playerId: string, slot: number): void {
    const player = this.players.get(playerId);
    if (player && slot >= 0 && slot < HOTBAR_SLOT_COUNT) player.selectedHotbar = slot;
  }

  moveSlot(playerId: string, move: { readonly from: number; readonly to: number }): void {
    const player = this.players.get(playerId);
    if (player) movePlayerInventorySlot(player.inventory, move);
  }

  equipArmor(playerId: string, req: { readonly slotIndex: number; readonly targetArmor?: ArmorSlotKey | undefined }): void {
    const player = this.players.get(playerId);
    if (!player) return;
    const updated = equipPlayerArmor(player.inventory, req);
    if (updated) player.inventory = updated;
  }

  unequipArmor(playerId: string, req: { readonly armorSlot: ArmorSlotKey; readonly targetSlot?: number | undefined }): void {
    const player = this.players.get(playerId);
    if (!player) return;
    const updated = unequipPlayerArmor(player.inventory, req);
    if (updated) player.inventory = updated;
  }

  craftRecipe(playerId: string, recipeId: string): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;
    const nearCampfire = isPlayerNearCampfire(this.cache, player.x, player.y);
    const updated = craftPlayerRecipe(player.inventory, { recipeId, nearCampfire });
    if (!updated) return false;
    player.inventory = updated;
    return true;
  }

  inventorySnapshot(playerId: string): InventorySnapshot | undefined {
    const player = this.players.get(playerId);
    if (!player) return undefined;
    const nearCampfire = isPlayerNearCampfire(this.cache, player.x, player.y);
    return buildInventorySnapshot({ state: player.inventory, selectedHotbar: player.selectedHotbar, nearCampfire });
  }

  step(dtSeconds = 1 / TICK_RATE): void {
    this.tick += 1;
    if (!this.dayPaused) this.dayPhase = wrapDayPhase(this.dayPhase + dtSeconds / DAY_DURATION_SECONDS);
    for (const player of this.players.values()) this.stepPlayer(player, dtSeconds);
  }

  private stepPlayer(player: SimPlayer, dtSeconds: number): void {
    const mag = Math.hypot(player.moveX, player.moveY);
    if (mag < 0.05) {
      player.moving = false;
      return;
    }
    const nx = player.moveX / Math.max(1, mag);
    const ny = player.moveY / Math.max(1, mag);
    player.facingX = nx;
    player.facingY = ny;
    player.moving = true;
    const step = PLAYER_SPEED_TILES_PER_SEC * dtSeconds;
    const result = resolveMovement({
      cache: this.cache, x: player.x, y: player.y, dx: nx * step, dy: ny * step, radius: PLAYER_RADIUS, elevation: player.elevation,
    });
    player.x = result.x;
    player.y = result.y;
    player.elevation = result.elevation;
    player.inWater = result.inWater;
  }

  snapshots(): PlayerSnapshot[] {
    return Array.from(this.players.values(), (p) => ({
      id: p.id, name: p.name, x: p.x, y: p.y, elevation: p.elevation, facingX: p.facingX, facingY: p.facingY,
      moving: p.moving, torchLit: p.torchLit, inWater: p.inWater, lastAckSeq: p.lastAckSeq,
      heldItem: p.inventory.slots[p.selectedHotbar]?.itemId ?? null,
    }));
  }
}
