/** Authoritative 20 Hz overworld simulation state. */
import {
  COMBAT_TUNING, DAY_DURATION_SECONDS, ELEVATION_DROP_TO_JUMP_Z, HOTBAR_SLOT_COUNT, STEALTH_TUNING, WorldChunkCache,
  playerFootSegment, resolveMovement, sanitizeCharacterAppearance, sampleStealthExposure, stepJumpArc, wrapDayPhase,
  type ArmorSlotKey, type CharacterAppearance, type ChatEntry, type DiscoveryStateSnapshot, type DropItemRequest, type InventorySnapshot,
  type PlayerSnapshot, type ProjectileSnapshot, type WorldChestSnapshot, type WorldDeltaSnapshot, type WorldEntitySnapshot, type WorldEvent, type WorldWebSnapshot, type GroundLootSnapshot,
} from "@dc2d/engine";
import { ProximityChatManager } from "./chat/proximityChat.js";
import { stepStationaryPlayerTurn } from "./combat/combatSimHelpers.js";
import { CombatWorld } from "./combatSim.js";
import {
  applyLoadoutEntries, buildInventorySnapshot, craftPlayerRecipe, equipPlayerArmor,
  isPlayerNearCampfire, isPlayerNearWorkbench, movePlayerInventorySlot, unequipPlayerArmor,
} from "./playerInventory.js";
import { normalizeOwnerKey } from "./survival/campStructures.js";
import { WorldPersistenceStore, type PersistedPlayerRecord, type PersistedWorldFile } from "./survival/persistenceStore.js";
import { applyPlayerAimInput, buildPlayerSnapshotRecord, computeDesiredPlayerDir, computeEffectiveStealthVis, isSprintingMove, setPlayerAimVec, stepPlayerSurvivalBuffs } from "./survival/playerSurvivalState.js";
import {
  buildFullWorldSaveSnapshot, createInitialSimPlayer, hydratePlayerProfileIfFound, loadWorldPersistence,
  persistPlayerSnapshotRecord, resolveSessionAuth, type SessionAuthResult, type SimPlayer,
} from "./survival/worldPersistenceSync.js";

export type { SimPlayer } from "./survival/worldPersistenceSync.js";
export const TICK_RATE = 20; const PLAYER_SPEED_TILES_PER_SEC = COMBAT_TUNING.movement.runSpeedTilesPerSec;
const PLAYER_RADIUS = COMBAT_TUNING.movement.collisionRadiusTiles; const INITIAL_DAY_PHASE = 0.62;

export class WorldSim {
  readonly cache: WorldChunkCache;
  readonly combat: CombatWorld;
  readonly chat = new ProximityChatManager();
  private readonly players = new Map<string, SimPlayer>();
  private readonly activeByAccountId = new Map<string, string>();
  private readonly persistence: WorldPersistenceStore;
  private readonly savedProfiles: Map<string, PersistedPlayerRecord>;
  private lastSavedDeltaRev = 0;
  private nextPlayerNum = 1;
  tick = 0;
  worldClockSec = 0;
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
    this.dayPaused = Boolean(file.dayPaused);
    this.worldClockSec = file.worldClockSec ?? 0;
    this.combat.harvester.importDepleted(file.depleted, this.cache);
    this.combat.structures.importState({ structures: file.structures, beds: file.beds, cache: this.cache, loot: this.combat.ecology.loot });
    this.combat.ecology.loot.importChests(file.chests);
    if (file.litBraziers?.length) {
      const cur = this.cache.worldDeltaSnapshot();
      this.cache.applyWorldDeltaSnapshot({ ...cur, litBraziers: file.litBraziers });
    }
    this.lastSavedDeltaRev = this.cache.deltaRevision();
  }

  private persistPlayer(p: SimPlayer): void {
    persistPlayerSnapshotRecord({
      host: { savedProfiles: this.savedProfiles, store: this.persistence },
      player: p,
      discovery: this.combat.discovery.snapshotFor(p.id),
    });
  }

  authenticateSession(req?: { readonly accountId?: string | undefined; readonly resumeToken?: string | undefined }): SessionAuthResult {
    return resolveSessionAuth({ savedProfiles: this.savedProfiles, ...req });
  }

  private activatePlayer(player: SimPlayer, accountId: string, persistNew: boolean): void {
    this.players.set(player.id, player);
    this.activeByAccountId.set(accountId, player.id);
    hydratePlayerProfileIfFound({
      host: { savedProfiles: this.savedProfiles, store: this.persistence },
      player,
      onHydrateDiscovery: (id, d) => this.combat.discovery.hydratePlayer(id, d),
    });
    if (persistNew && !this.savedProfiles.has(accountId)) this.persistPlayer(player);
  }

  addPlayer(
    name: string,
    appearance?: CharacterAppearance,
    auth?: { readonly accountId: string; readonly tokenHash?: string | undefined; readonly onEvict?: (oldPlayerId: string) => void },
  ): string {
    const accountId = auth?.accountId ?? normalizeOwnerKey(name);
    const existingId = this.activeByAccountId.get(accountId);
    if (existingId) { auth?.onEvict?.(existingId); this.removePlayer(existingId); }
    const id = `p${this.nextPlayerNum++}`;
    const player = createInitialSimPlayer({ id, accountId, tokenHash: auth?.tokenHash, name, appearance, activeCount: this.players.size });
    this.activatePlayer(player, accountId, Boolean(auth?.tokenHash));
    return id;
  }

  removePlayer(playerId: string): void {
    const p = this.players.get(playerId);
    if (p) {
      if (this.activeByAccountId.get(p.accountId) === p.id) this.activeByAccountId.delete(p.accountId);
      this.persistPlayer(p);
      this.combat.pushEvent({ kind: "playerLeave", x: p.x, y: p.y, actorId: p.id });
    }
    this.chat.removePlayer(playerId); this.combat.removePlayer(playerId); this.players.delete(playerId);
  }
  getPlayer(playerId: string): SimPlayer | undefined { return this.players.get(playerId); }
  markPersistenceDirty(): void { this.persistence.markDirty(); }
  discoverySnapshot(playerId: string): DiscoveryStateSnapshot { return this.combat.discovery.snapshotFor(playerId); }
  sendChat(playerId: string, text: string, shout?: boolean): ChatEntry | null { const p = this.players.get(playerId); return p ? this.chat.sendMessage({ senderId: p.id, senderName: p.name, x: p.x, y: p.y, rawText: text, shout, tick: this.tick }) : null; }
  useItem(playerId: string, slotIndex: number): void { const p = this.players.get(playerId); if (p && this.combat.useItemSlot(p, slotIndex)) this.persistPlayer(p); }
  drainChatMessages(): ChatEntry[] { return this.chat.drainMessages(); }
  setPlayerName(playerId: string, name: string): void { const p = this.players.get(playerId); if (p) p.name = name.trim().slice(0, 24) || p.name; }

  setAppearance(playerId: string, req: { readonly name?: string | undefined; readonly appearance: CharacterAppearance }): void {
    const p = this.players.get(playerId);
    if (!p) return;
    if (req.name) p.name = req.name.trim().slice(0, 24) || p.name;
    p.appearance = sanitizeCharacterAppearance(req.appearance);
    this.persistPlayer(p);
  }

  queueInput(playerId: string, input: {
    readonly seq: number; readonly moveX: number; readonly moveY: number; readonly aimX?: number | undefined; readonly aimY?: number | undefined;
    readonly jump?: boolean | undefined; readonly attack?: boolean | undefined; readonly attackHold?: boolean | undefined; readonly bowDraw?: boolean | undefined; readonly bowRelease?: boolean | undefined;
    readonly block?: boolean | undefined; readonly dodge?: boolean | undefined; readonly dodgeDirX?: number | undefined; readonly dodgeDirY?: number | undefined;
    readonly crouch?: boolean | undefined; readonly throwPebble?: boolean | undefined; readonly interact?: boolean | undefined;
  }): void {
    const p = this.players.get(playerId);
    if (!p || input.seq <= p.lastAckSeq || input.seq > p.lastAckSeq + 1024) return;
    p.moveX = input.moveX; p.moveY = input.moveY; p.lastAckSeq = input.seq;
    p.crouching = Boolean(input.crouch) && !input.dodge && !input.jump;
    this.applyActionInputs(p, input); applyPlayerAimInput(p, input);
  }

  private applyActionInputs(p: SimPlayer, input: {
    readonly jump?: boolean | undefined; readonly attack?: boolean | undefined; readonly attackHold?: boolean | undefined; readonly bowDraw?: boolean | undefined; readonly bowRelease?: boolean | undefined;
    readonly block?: boolean | undefined; readonly dodge?: boolean | undefined; readonly dodgeDirX?: number | undefined; readonly dodgeDirY?: number | undefined;
    readonly throwPebble?: boolean | undefined; readonly interact?: boolean | undefined;
  }): void {
    p.attackHold = Boolean(input.attackHold); p.bowDrawing = Boolean(input.bowDraw); p.blockHeld = Boolean(input.block);
    if (input.jump) p.jumpQueued = true; if (input.attack) p.attackQueued = true; if (input.bowRelease) p.bowReleaseQueued = true;
    if (input.dodge) { p.dodgeQueued = true; p.dodgeDirX = input.dodgeDirX; p.dodgeDirY = input.dodgeDirY; }
    if (input.throwPebble) p.throwPebbleQueued = true; if (input.interact) p.interactQueued = true;
  }

  respawnPlayer(playerId: string): void { const p = this.players.get(playerId); if (p) this.combat.respawnPlayerNow(p, this.combat.structures.respawnPointFor(p.accountId)); }
  toggleTorch(playerId: string): void { const p = this.players.get(playerId); if (p) p.torchLit = !p.torchLit; }
  setDayPhase(dayPhase: number, paused?: boolean): void { this.dayPhase = wrapDayPhase(dayPhase); if (paused !== undefined) this.dayPaused = paused; }
  ackActionSeq(playerId: string, seq?: number): void { const p = this.players.get(playerId); if (p && seq !== undefined && seq > p.lastActionAckSeq && seq <= p.lastActionAckSeq + 1024) p.lastActionAckSeq = seq; }
  actionAckSeq(playerId: string): number { return this.players.get(playerId)?.lastActionAckSeq ?? 0; }
  selectHotbar(playerId: string, slot: number): void { const p = this.players.get(playerId); if (p && slot >= 0 && slot < HOTBAR_SLOT_COUNT) p.selectedHotbar = slot; }
  grantPlayerItems(playerId: string, entries: readonly { readonly slot: number; readonly itemId: string; readonly count: number }[]): void { const p = this.players.get(playerId); if (p) applyLoadoutEntries(p.inventory, entries); }
  moveSlot(playerId: string, move: { readonly from: number; readonly to: number }): void { const p = this.players.get(playerId); if (p && movePlayerInventorySlot(p.inventory, move)) this.persistPlayer(p); }
  equipArmor(playerId: string, req: { readonly slotIndex: number; readonly targetArmor?: ArmorSlotKey | undefined }): void {
    const p = this.players.get(playerId);
    const u = p ? equipPlayerArmor(p.inventory, req) : null;
    if (p && u) { p.inventory = u; this.persistPlayer(p); }
  }
  unequipArmor(playerId: string, req: { readonly armorSlot: ArmorSlotKey; readonly targetSlot?: number | undefined }): void {
    const p = this.players.get(playerId);
    const u = p ? unequipPlayerArmor(p.inventory, req) : null;
    if (p && u) { p.inventory = u; this.persistPlayer(p); }
  }
  craftRecipe(playerId: string, recipeId: string): boolean {
    const p = this.players.get(playerId);
    if (!p) return false;
    const u = craftPlayerRecipe(p.inventory, { recipeId, nearCampfire: isPlayerNearCampfire(this.cache, p.x, p.y), nearWorkbench: isPlayerNearWorkbench(this.cache, p.x, p.y) });
    if (!u) return false;
    p.inventory = u; this.persistPlayer(p); return true;
  }
  placeStructure(playerId: string, req: { readonly itemId: string; readonly x: number; readonly y: number }): boolean {
    const p = this.players.get(playerId);
    const ok = p ? this.combat.placeStructure({ player: p, playerName: p.name, accountId: p.accountId, ...req }) : false;
    if (p && ok) this.persistPlayer(p);
    return ok;
  }
  setRespawnBed(playerId: string, structureId: string): boolean { const p = this.players.get(playerId); return p ? this.combat.setRespawnBed({ player: p, playerName: p.name, accountId: p.accountId, structureId }) : false; }
  worldDeltaSnapshot(): WorldDeltaSnapshot { return this.cache.worldDeltaSnapshot(); }
  private buildSaveSnapshot(): ReturnType<typeof buildFullWorldSaveSnapshot> {
    const beds = this.combat.structures.exportState().beds;
    return buildFullWorldSaveSnapshot({ worldSeed: this.worldSeed, dayPhase: this.dayPhase, dayPaused: this.dayPaused, worldClockSec: this.worldClockSec, sim: this, savedProfiles: this.savedProfiles, activePlayers: this.players.values(), beds });
  }
  savePersistenceNow(): void { this.persistence.saveNow(this.buildSaveSnapshot()); }
  debugSpawnNearPlayer(playerId: string, kind: Parameters<CombatWorld["debugSpawnNearPlayer"]>[1], count = 1): void { const p = this.players.get(playerId); if (p) this.combat.debugSpawnNearPlayer(p, kind, count); }
  handleAdminAction(playerId: string, req: Parameters<CombatWorld["handleAdminAction"]>[1]): void { const p = this.players.get(playerId); if (p && this.combat.handleAdminAction(p, req)) this.persistPlayer(p); }
  handleChestAction(playerId: string, req: Parameters<CombatWorld["handleChestRequest"]>[1]): void { const p = this.players.get(playerId); if (p) { this.combat.handleChestRequest(p, req); this.persistPlayer(p); } }
  pickupLoot(playerId: string, lootId?: string): void { const p = this.players.get(playerId); if (p && this.combat.pickupLoot(p, lootId)) this.persistPlayer(p); }
  dropItem(playerId: string, req: DropItemRequest): void { const p = this.players.get(playerId); if (p && this.combat.dropPlayerItem(p, req)) this.persistPlayer(p); }
  inventorySnapshot(playerId: string): InventorySnapshot | undefined {
    const p = this.players.get(playerId);
    return p ? buildInventorySnapshot({ state: p.inventory, selectedHotbar: p.selectedHotbar, nearCampfire: isPlayerNearCampfire(this.cache, p.x, p.y), nearWorkbench: isPlayerNearWorkbench(this.cache, p.x, p.y), ackSeq: p.lastActionAckSeq }) : undefined;
  }

  step(dtSeconds = 1 / TICK_RATE): void {
    this.tick += 1; this.worldClockSec += dtSeconds;
    if (!this.dayPaused) this.dayPhase = wrapDayPhase(this.dayPhase + dtSeconds / DAY_DURATION_SECONDS);
    this.chat.step(dtSeconds);
    for (const p of this.players.values()) this.stepPlayer(p, dtSeconds);
    if (this.combat.stepWorld({ players: this.players, dt: dtSeconds, dayPhase: this.dayPhase, timeSec: this.worldClockSec })) this.persistence.markDirty();
    if (this.cache.deltaRevision() !== this.lastSavedDeltaRev) { this.lastSavedDeltaRev = this.cache.deltaRevision(); this.persistence.markDirty(); }
    this.persistence.maybeFlush(Date.now(), () => this.buildSaveSnapshot());
  }

  private stepPlayer(p: SimPlayer, dtSeconds: number): void {
    const arc = stepJumpArc({ jumpZ: p.jumpZ, jumpVz: p.jumpVz }, p.jumpQueued && !p.inDeepWater, dtSeconds);
    p.jumpZ = arc.jumpZ; p.jumpVz = arc.jumpVz;
    this.combat.stepPlayerAction({
      player: p, players: this.players, playerName: p.name, respawnPos: this.combat.structures.respawnPointFor(p.accountId), dt: dtSeconds,
      input: { moveX: p.moveX, moveY: p.moveY, attackQueued: p.attackQueued, attackHold: p.attackHold, bowDrawing: p.bowDrawing, bowReleaseQueued: p.bowReleaseQueued, blockHeld: p.blockHeld, dodgeQueued: p.dodgeQueued, dodgeDirX: p.dodgeDirX, dodgeDirY: p.dodgeDirY, throwPebble: p.throwPebbleQueued, interactQueued: p.interactQueued },
    });
    stepPlayerSurvivalBuffs({ p, nearCampfire: isPlayerNearCampfire(this.cache, p.x, p.y), dt: dtSeconds });
    p.jumpQueued = false; p.attackQueued = false; p.bowReleaseQueued = false; p.dodgeQueued = false;
    p.dodgeDirX = undefined; p.dodgeDirY = undefined; p.throwPebbleQueued = false; p.interactQueued = false;
    this.movePlayer(p, dtSeconds);
    this.updateStealthAndNoise(p, dtSeconds);
  }

  private updateStealthAndNoise(p: SimPlayer, dtSeconds: number): void {
    if (p.sprinting) p.crouching = false;
    p.attackFlashTimer = Math.max(0, p.attackFlashTimer - dtSeconds);
    const exp = sampleStealthExposure({ cache: this.cache, x: p.x, y: p.y, dayPhase: this.dayPhase, torchLit: p.torchLit, crouching: p.crouching, moving: p.moving, sprinting: p.sprinting, inWater: p.inWater || p.inDeepWater, attackFlash: p.attackFlashTimer > 0 });
    const vis = computeEffectiveStealthVis(p, exp.visibility);
    p.stealthVis = vis; p.visibility = vis; p.inCover = exp.inCover; p.noiseRadius = exp.noiseRadius;
    if (p.sprinting && !p.crouching) {
      p.sprintNoiseAcc += dtSeconds;
      if (p.sprintNoiseAcc >= 0.45) { p.sprintNoiseAcc = 0; this.combat.ecology.emitNoise({ x: p.x, y: p.y, radius: STEALTH_TUNING.sprintNoiseRadiusTiles, sourceId: p.id }); }
    } else {
      p.sprintNoiseAcc = 0;
    }
  }

  private movePlayer(p: SimPlayer, dtSeconds: number): void {
    const dir = computeDesiredPlayerDir(p);
    const heldItem = p.inventory.slots[p.selectedHotbar]?.itemId;
    const combat = p.combat;
    if (!dir) {
      p.moving = false; p.sprinting = false;
      stepStationaryPlayerTurn({ cache: this.cache, p: { ...p, heldItem, bowCharge: combat.bowCharge, heavyCharge: combat.heavyCharge } });
      return;
    }
    if (!p.hasExplicitAim && combat.dodgeTimer <= 0) setPlayerAimVec(p, dir.ux, dir.uy);
    const seg = playerFootSegment({ facingX: p.facingX, facingY: p.facingY, aimX: p.aimX, aimY: p.aimY, heldItem, bowCharge: combat.bowCharge, heavyCharge: combat.heavyCharge });
    const mult = this.combat.moveMultiplier(p);
    const step = PLAYER_SPEED_TILES_PER_SEC * mult * dtSeconds;
    const res = resolveMovement({ cache: this.cache, x: p.x, y: p.y, dx: dir.nx * step, dy: dir.ny * step, radius: PLAYER_RADIUS, footSegX: seg.segX, footSegY: seg.segY, elevation: p.elevation, airborne: p.jumpZ > 0.02, jumpZ: p.jumpZ });
    p.x = res.x; p.y = res.y; p.elevation = res.elevation;
    p.inWater = res.inWater; p.inDeepWater = res.inDeepWater;
    p.moving = true; p.sprinting = isSprintingMove({ mag: dir.mag, mult, inWater: res.inWater, dodging: combat.dodgeTimer > 0 });
    if (res.elevationDrop !== 0) p.jumpZ = Math.max(0, p.jumpZ + res.elevationDrop * ELEVATION_DROP_TO_JUMP_Z);
  }

  combatSnapshots(): { readonly projectiles: ProjectileSnapshot[]; readonly entities: WorldEntitySnapshot[]; readonly chests: WorldChestSnapshot[]; readonly groundLoot: GroundLootSnapshot[]; readonly webs?: WorldWebSnapshot | undefined } { return this.combat.snapshots(); }
  drainCombatEvents(): WorldEvent[] { return this.combat.drainEvents(); }
  snapshots(): PlayerSnapshot[] {
    return Array.from(this.players.values(), (p) => buildPlayerSnapshotRecord(p, {
      hasBedRespawn: this.combat.structures.hasBedFor(p.accountId),
      bubble: this.chat.activeBubbleFor(p.id),
      cache: this.cache,
    }));
  }
}
