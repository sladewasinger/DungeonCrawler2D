/** Authoritative 20 Hz overworld simulation state. */
import {
  COMBAT_TUNING, DAY_DURATION_SECONDS, DEFAULT_APPEARANCE, ELEVATION_DROP_TO_JUMP_Z, HOTBAR_SLOT_COUNT, STEALTH_TUNING, WorldChunkCache, resolveMovement,
  sanitizeCharacterAppearance, sampleStealthExposure, stepJumpArc, wrapDayPhase,
  type ArmorSlotKey, type CharacterAppearance, type GroundLootSnapshot, type InventorySnapshot, type PlayerInventoryState,
  type PlayerSnapshot, type ProjectileSnapshot, type WorldChestSnapshot, type WorldDeltaSnapshot, type WorldEntitySnapshot, type WorldEvent,
} from "@dc2d/engine";
import { createCombatState, type PlayerCombatState } from "./combatActions.js";
import { CombatWorld, playerCombatExtras } from "./combatSim.js";
import {
  buildInventorySnapshot, craftPlayerRecipe, createStarterInventory, equipPlayerArmor,
  isPlayerNearCampfire, movePlayerInventorySlot, unequipPlayerArmor,
} from "./playerInventory.js";
import { normalizeOwnerKey } from "./survival/campStructures.js";
import { WorldPersistenceStore, type PersistedPlayerRecord, type PersistedWorldFile } from "./survival/persistenceStore.js";
import { stepPlayerSurvivalBuffs } from "./survival/playerSurvivalState.js";
import { buildFullWorldSaveSnapshot, hydratePlayerProfileIfFound, loadWorldPersistence } from "./survival/worldPersistenceSync.js";

export const TICK_RATE = 20;
export const PLAYER_SPEED_TILES_PER_SEC = COMBAT_TUNING.movement.runSpeedTilesPerSec;
export const PLAYER_RADIUS = COMBAT_TUNING.movement.collisionRadiusTiles;
export const INITIAL_DAY_PHASE = 0.62;

export interface SimPlayer {
  readonly id: string; name: string; appearance: CharacterAppearance;
  x: number; y: number; elevation: number; facingX: number; facingY: number; aimX: number; aimY: number; hasExplicitAim: boolean;
  jumpZ: number; jumpVz: number; jumpQueued: boolean; moveX: number; moveY: number; moving: boolean; sprinting: boolean;
  crouching: boolean; stealthVis: number; inCover: boolean; noiseRadius: number; visibility: number; sprintNoiseAcc: number;
  torchLit: boolean; inWater: boolean; inDeepWater: boolean; lastAckSeq: number; lastActionAckSeq: number;
  selectedHotbar: number; inventory: PlayerInventoryState;
  attackQueued: boolean; bowDrawing: boolean; bowReleaseQueued: boolean; blockHeld: boolean; dodgeQueued: boolean;
  dodgeDirX: number | undefined; dodgeDirY: number | undefined; throwPebbleQueued: boolean; interactQueued: boolean;
  readonly combat: PlayerCombatState; profileHydrated: boolean;
}

export class WorldSim {
  readonly cache: WorldChunkCache;
  readonly combat: CombatWorld;
  private readonly players = new Map<string, SimPlayer>();
  private readonly persistence: WorldPersistenceStore;
  private readonly savedProfiles: Map<string, PersistedPlayerRecord>;
  private lastSavedDeltaRev = 0;
  private nextPlayerNum = 1;
  tick = 0;
  dayPhase = INITIAL_DAY_PHASE;
  dayPaused = false;

  constructor(readonly worldSeed = 1337, options?: { readonly persistencePath?: string | undefined }) {
    this.cache = new WorldChunkCache(worldSeed);
    this.cache.getChunk(0, 0);
    this.combat = new CombatWorld(this.cache);
    this.persistence = new WorldPersistenceStore(options?.persistencePath);
    this.savedProfiles = loadWorldPersistence({
      store: this.persistence, worldSeed,
      onHydrate: (file) => this.hydrateWorldFile(file),
    });
  }

  private hydrateWorldFile(file: PersistedWorldFile): void {
    this.dayPhase = file.dayPhase;
    this.combat.harvester.importDepleted(file.depleted, this.cache);
    this.combat.structures.importState({ structures: file.structures, beds: file.beds, cache: this.cache, loot: this.combat.ecology.loot });
    this.combat.ecology.loot.importChests(file.chests);
    this.lastSavedDeltaRev = this.cache.deltaRevision();
  }

  addPlayer(name: string, appearance: CharacterAppearance = DEFAULT_APPEARANCE): string {
    const id = `p${this.nextPlayerNum++}`;
    const offset = ((this.players.size % 4) - 1.5) * 0.6;
    const player: SimPlayer = {
      id, name, appearance: sanitizeCharacterAppearance(appearance),
      x: 0.5 + offset, y: 0.5, elevation: 0, facingX: 0, facingY: 1, aimX: 0, aimY: 1, hasExplicitAim: false,
      jumpZ: 0, jumpVz: 0, jumpQueued: false,
      moveX: 0, moveY: 0, moving: false, sprinting: false, crouching: false, stealthVis: 0.7, inCover: false, noiseRadius: 0.5, visibility: 0.7, sprintNoiseAcc: 0,
      torchLit: true, inWater: false, inDeepWater: false, lastAckSeq: 0, lastActionAckSeq: 0,
      selectedHotbar: 0, inventory: createStarterInventory(),
      attackQueued: false, bowDrawing: false, bowReleaseQueued: false, blockHeld: false, dodgeQueued: false, dodgeDirX: undefined, dodgeDirY: undefined, throwPebbleQueued: false, interactQueued: false,
      combat: createCombatState(), profileHydrated: false,
    };
    this.players.set(id, player);
    hydratePlayerProfileIfFound({ host: { savedProfiles: this.savedProfiles, store: this.persistence }, player });
    return id;
  }

  removePlayer(playerId: string): void {
    const p = this.players.get(playerId);
    if (p) {
      this.savedProfiles.set(normalizeOwnerKey(p.name), { ownerKey: normalizeOwnerKey(p.name), x: p.x, y: p.y, elevation: p.elevation, appearance: p.appearance, inventory: p.inventory, wellFedTimer: p.combat.wellFedTimer, restedTimer: p.combat.restedTimer });
      this.persistence.markDirty();
      this.combat.pushEvent({ kind: "playerLeave", x: p.x, y: p.y, actorId: p.id });
    }
    this.players.delete(playerId);
  }
  setPlayerName(playerId: string, name: string): void {
    const p = this.players.get(playerId);
    if (!p) return;
    if (p.name === "Traveler" && name !== "Traveler") p.profileHydrated = false;
    p.name = name;
    hydratePlayerProfileIfFound({ host: { savedProfiles: this.savedProfiles, store: this.persistence }, player: p });
  }

  setAppearance(playerId: string, req: { readonly name?: string | undefined; readonly appearance: CharacterAppearance }): void {
    const p = this.players.get(playerId);
    if (!p) return;
    const prevName = p.name;
    if (req.name) p.name = req.name.trim().slice(0, 24) || p.name;
    if (prevName === "Traveler" && p.name !== "Traveler") p.profileHydrated = false;
    hydratePlayerProfileIfFound({ host: { savedProfiles: this.savedProfiles, store: this.persistence }, player: p });
    p.appearance = sanitizeCharacterAppearance(req.appearance);
    this.persistence.markDirty();
  }

  queueInput(playerId: string, input: {
    readonly seq: number; readonly moveX: number; readonly moveY: number; readonly aimX?: number | undefined; readonly aimY?: number | undefined;
    readonly jump?: boolean | undefined; readonly attack?: boolean | undefined; readonly bowDraw?: boolean | undefined; readonly bowRelease?: boolean | undefined;
    readonly block?: boolean | undefined; readonly dodge?: boolean | undefined; readonly dodgeDirX?: number | undefined; readonly dodgeDirY?: number | undefined;
    readonly crouch?: boolean | undefined; readonly throwPebble?: boolean | undefined; readonly interact?: boolean | undefined;
  }): void {
    const p = this.players.get(playerId);
    if (!p) return;
    p.moveX = input.moveX; p.moveY = input.moveY; p.lastAckSeq = input.seq;
    p.crouching = Boolean(input.crouch) && !input.dodge && !input.jump;
    this.applyActionInputs(p, input); applyAimInput(p, input);
  }

  private applyActionInputs(p: SimPlayer, input: {
    readonly jump?: boolean | undefined; readonly attack?: boolean | undefined; readonly bowDraw?: boolean | undefined; readonly bowRelease?: boolean | undefined;
    readonly block?: boolean | undefined; readonly dodge?: boolean | undefined; readonly dodgeDirX?: number | undefined; readonly dodgeDirY?: number | undefined;
    readonly throwPebble?: boolean | undefined; readonly interact?: boolean | undefined;
  }): void {
    p.bowDrawing = Boolean(input.bowDraw); p.blockHeld = Boolean(input.block);
    if (input.jump) p.jumpQueued = true; if (input.attack) p.attackQueued = true; if (input.bowRelease) p.bowReleaseQueued = true;
    if (input.dodge) { p.dodgeQueued = true; p.dodgeDirX = input.dodgeDirX; p.dodgeDirY = input.dodgeDirY; }
    if (input.throwPebble) p.throwPebbleQueued = true; if (input.interact) p.interactQueued = true;
  }

  respawnPlayer(playerId: string): void { const p = this.players.get(playerId); if (p) this.combat.respawnPlayerNow(p, this.combat.structures.respawnPointFor(p.name)); }
  toggleTorch(playerId: string): void { const p = this.players.get(playerId); if (p) p.torchLit = !p.torchLit; }
  setDayPhase(dayPhase: number, paused?: boolean): void { this.dayPhase = wrapDayPhase(dayPhase); if (paused !== undefined) this.dayPaused = paused; }
  ackActionSeq(playerId: string, seq?: number): void { const p = this.players.get(playerId); if (p && seq !== undefined) p.lastActionAckSeq = Math.max(p.lastActionAckSeq, seq); }
  actionAckSeq(playerId: string): number { return this.players.get(playerId)?.lastActionAckSeq ?? 0; }
  selectHotbar(playerId: string, slot: number): void { const p = this.players.get(playerId); if (p && slot >= 0 && slot < HOTBAR_SLOT_COUNT) p.selectedHotbar = slot; }
  moveSlot(playerId: string, move: { readonly from: number; readonly to: number }): void { const p = this.players.get(playerId); if (p && movePlayerInventorySlot(p.inventory, move)) this.persistence.markDirty(); }
  equipArmor(playerId: string, req: { readonly slotIndex: number; readonly targetArmor?: ArmorSlotKey | undefined }): void {
    const p = this.players.get(playerId);
    const u = p ? equipPlayerArmor(p.inventory, req) : null;
    if (p && u) { p.inventory = u; this.persistence.markDirty(); }
  }
  unequipArmor(playerId: string, req: { readonly armorSlot: ArmorSlotKey; readonly targetSlot?: number | undefined }): void {
    const p = this.players.get(playerId);
    const u = p ? unequipPlayerArmor(p.inventory, req) : null;
    if (p && u) { p.inventory = u; this.persistence.markDirty(); }
  }
  craftRecipe(playerId: string, recipeId: string): boolean {
    const p = this.players.get(playerId);
    if (!p) return false;
    const u = craftPlayerRecipe(p.inventory, { recipeId, nearCampfire: isPlayerNearCampfire(this.cache, p.x, p.y) });
    if (!u) return false;
    p.inventory = u; this.persistence.markDirty(); return true;
  }
  placeStructure(playerId: string, req: { readonly itemId: string; readonly x: number; readonly y: number }): boolean { const p = this.players.get(playerId); return p ? this.combat.placeStructure({ player: p, playerName: p.name, ...req }) : false; }
  setRespawnBed(playerId: string, structureId: string): boolean { const p = this.players.get(playerId); return p ? this.combat.setRespawnBed({ player: p, playerName: p.name, structureId }) : false; }
  worldDeltaSnapshot(): WorldDeltaSnapshot { return this.cache.worldDeltaSnapshot(); }
  savePersistenceNow(): void {
    const beds = this.combat.structures.exportState().beds;
    this.persistence.saveNow(buildFullWorldSaveSnapshot({ worldSeed: this.worldSeed, dayPhase: this.dayPhase, sim: this, savedProfiles: this.savedProfiles, activePlayers: this.players.values(), beds }));
  }
  debugSpawnNearPlayer(playerId: string, kind: Parameters<CombatWorld["debugSpawnNearPlayer"]>[1], count = 1): void { const p = this.players.get(playerId); if (p) this.combat.debugSpawnNearPlayer(p, kind, count); }
  handleChestAction(playerId: string, req: Parameters<CombatWorld["handleChestRequest"]>[1]): void { const p = this.players.get(playerId); if (p) { this.combat.handleChestRequest(p, req); this.persistence.markDirty(); } }
  inventorySnapshot(playerId: string): InventorySnapshot | undefined { const p = this.players.get(playerId); return p ? buildInventorySnapshot({ state: p.inventory, selectedHotbar: p.selectedHotbar, nearCampfire: isPlayerNearCampfire(this.cache, p.x, p.y), ackSeq: p.lastActionAckSeq }) : undefined; }

  step(dtSeconds = 1 / TICK_RATE): void {
    this.tick += 1;
    if (!this.dayPaused) this.dayPhase = wrapDayPhase(this.dayPhase + dtSeconds / DAY_DURATION_SECONDS);
    for (const p of this.players.values()) this.stepPlayer(p, dtSeconds);
    this.combat.stepWorld({ players: this.players, dt: dtSeconds, dayPhase: this.dayPhase, timeSec: this.tick / TICK_RATE });
    if (this.cache.deltaRevision() !== this.lastSavedDeltaRev) { this.lastSavedDeltaRev = this.cache.deltaRevision(); this.persistence.markDirty(); }
    const beds = this.combat.structures.exportState().beds;
    this.persistence.maybeFlush(Date.now(), () => buildFullWorldSaveSnapshot({ worldSeed: this.worldSeed, dayPhase: this.dayPhase, sim: this, savedProfiles: this.savedProfiles, activePlayers: this.players.values(), beds }));
  }

  private stepPlayer(p: SimPlayer, dtSeconds: number): void {
    const arc = stepJumpArc({ jumpZ: p.jumpZ, jumpVz: p.jumpVz }, p.jumpQueued && !p.inDeepWater, dtSeconds);
    p.jumpZ = arc.jumpZ; p.jumpVz = arc.jumpVz;
    this.combat.stepPlayerAction({
      player: p, players: this.players, playerName: p.name, respawnPos: this.combat.structures.respawnPointFor(p.name), dt: dtSeconds,
      input: { moveX: p.moveX, moveY: p.moveY, attackQueued: p.attackQueued, bowDrawing: p.bowDrawing, bowReleaseQueued: p.bowReleaseQueued, blockHeld: p.blockHeld, dodgeQueued: p.dodgeQueued, dodgeDirX: p.dodgeDirX, dodgeDirY: p.dodgeDirY, throwPebble: p.throwPebbleQueued, interactQueued: p.interactQueued },
    });
    stepPlayerSurvivalBuffs({ p, nearCampfire: isPlayerNearCampfire(this.cache, p.x, p.y), dt: dtSeconds });
    p.jumpQueued = false; p.attackQueued = false; p.bowReleaseQueued = false; p.dodgeQueued = false;
    p.dodgeDirX = undefined; p.dodgeDirY = undefined; p.throwPebbleQueued = false; p.interactQueued = false;
    this.movePlayer(p, dtSeconds);
    this.updateStealthAndNoise(p, dtSeconds);
  }

  private updateStealthAndNoise(p: SimPlayer, dtSeconds: number): void {
    if (p.sprinting) p.crouching = false;
    const exp = sampleStealthExposure({ cache: this.cache, x: p.x, y: p.y, dayPhase: this.dayPhase, torchLit: p.torchLit, crouching: p.crouching, moving: p.moving, sprinting: p.sprinting });
    p.stealthVis = exp.visibility; p.visibility = exp.visibility; p.inCover = exp.inCover; p.noiseRadius = exp.noiseRadius;
    if (p.sprinting && !p.crouching) {
      p.sprintNoiseAcc += dtSeconds;
      if (p.sprintNoiseAcc >= 0.45) { p.sprintNoiseAcc = 0; this.combat.ecology.emitNoise({ x: p.x, y: p.y, radius: STEALTH_TUNING.sprintNoiseRadiusTiles, sourceId: p.id }); }
    } else {
      p.sprintNoiseAcc = 0;
    }
  }

  private movePlayer(p: SimPlayer, dtSeconds: number): void {
    const dir = desiredPlayerDir(p);
    if (!dir) { p.moving = false; p.sprinting = false; return; }
    const { nx, ny, mag } = dir;
    if (!p.hasExplicitAim && p.combat.dodgeTimer <= 0) setPlayerAim(p, dir.rawX / mag, dir.rawY / mag);
    const mult = this.combat.moveMultiplier(p);
    const step = PLAYER_SPEED_TILES_PER_SEC * mult * dtSeconds;
    const res = resolveMovement({
      cache: this.cache, x: p.x, y: p.y, dx: nx * step, dy: ny * step,
      radius: PLAYER_RADIUS, elevation: p.elevation, airborne: p.jumpZ > 0.02, jumpZ: p.jumpZ,
    });
    p.x = res.x; p.y = res.y; p.elevation = res.elevation;
    p.inWater = res.inWater; p.inDeepWater = res.inDeepWater; p.moving = true;
    p.sprinting = isSprintingMove({ mag, mult, inWater: res.inWater, dodging: p.combat.dodgeTimer > 0 });
    if (res.elevationDrop !== 0) p.jumpZ = Math.max(0, p.jumpZ + res.elevationDrop * ELEVATION_DROP_TO_JUMP_Z);
  }

  combatSnapshots(): {
    readonly projectiles: ProjectileSnapshot[]; readonly entities: WorldEntitySnapshot[];
    readonly chests: WorldChestSnapshot[]; readonly groundLoot: GroundLootSnapshot[];
  } { return this.combat.snapshots(); }

  drainCombatEvents(): WorldEvent[] { return this.combat.drainEvents(); }

  snapshots(): PlayerSnapshot[] {
    return Array.from(this.players.values(), (p) => ({
      id: p.id, name: p.name, x: p.x, y: p.y, elevation: p.elevation,
      facingX: p.facingX, facingY: p.facingY, aimX: p.aimX, aimY: p.aimY,
      jumpZ: p.jumpZ, jumpVz: p.jumpVz,
      moving: p.moving, sprinting: p.sprinting, crouching: p.crouching, stealthVis: p.stealthVis, inCover: p.inCover,
      torchLit: p.torchLit, inWater: p.inWater, inDeepWater: p.inDeepWater, lastAckSeq: p.lastAckSeq,
      heldItem: p.inventory.slots[p.selectedHotbar]?.itemId ?? null,
      appearance: p.appearance, armor: { ...p.inventory.armor },
      hasBedRespawn: this.combat.structures.hasBedFor(p.name),
      ...playerCombatExtras(p),
    }));
  }
}

function isSprintingMove(opts: { readonly mag: number; readonly mult: number; readonly inWater: boolean; readonly dodging: boolean }): boolean {
  return opts.mag > 0.82 && opts.mult >= 0.99 && !opts.inWater && !opts.dodging;
}

function desiredPlayerDir(p: SimPlayer): { readonly rawX: number; readonly rawY: number; readonly nx: number; readonly ny: number; readonly mag: number } | null {
  if (p.combat.staggerTimer > 0 || p.combat.respawnTimer > 0) return null;
  const dodging = p.combat.dodgeTimer > 0;
  const rawX = dodging ? p.combat.dodgeDirX : p.moveX;
  const rawY = dodging ? p.combat.dodgeDirY : p.moveY;
  const mag = Math.hypot(rawX, rawY);
  if (mag < 0.05) return null;
  const denom = Math.max(1, mag);
  return { rawX, rawY, nx: rawX / denom, ny: rawY / denom, mag };
}

function setPlayerAim(p: SimPlayer, ax: number, ay: number): void {
  p.aimX = ax; p.aimY = ay;
  p.facingX = ax; p.facingY = ay;
}

function applyAimInput(p: SimPlayer, input: { readonly aimX?: number | undefined; readonly aimY?: number | undefined }): void {
  if (input.aimX === undefined || input.aimY === undefined) { p.hasExplicitAim = false; return; }
  const mag = Math.hypot(input.aimX, input.aimY);
  if (mag <= 0.05) { p.hasExplicitAim = false; return; }
  setPlayerAim(p, input.aimX / mag, input.aimY / mag);
  p.hasExplicitAim = true;
}
