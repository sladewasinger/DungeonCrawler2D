/** Authoritative 20 Hz overworld simulation state. */
import {
  DAY_DURATION_SECONDS, HOTBAR_SLOT_COUNT, exportAllFogDeltas, sanitizeCharacterAppearance, wrapDayPhase,
  type ArmorSlotKey, type CharacterAppearance, type ChatEntry, type ClientMessage, type DiscoveryStateSnapshot,
  type DropItemRequest, type FogChunkDelta, type GroundLootSnapshot, type InventorySnapshot, type PlayerSnapshot,
  type ProjectileSnapshot, type WorldChestSnapshot, type WorldChunkCache, type WorldDeltaSnapshot,
  type WorldEntitySnapshot, type WorldEvent, type WorldWebSnapshot,
} from "@dc2d/engine";
import { ProximityChatManager } from "./chat/proximityChat.js";
import type { CombatWorld } from "./combatSim.js";
import { WorldHubCoordinator, attachHubCombatHooks } from "./hubs/hubCoordinator.js";
import {
  applyLoadoutEntries, buildInventorySnapshot, craftPlayerRecipe, equipPlayerArmor,
  isPlayerNearCampfire, isPlayerNearWorkbench, movePlayerInventorySlot, unequipPlayerArmor,
} from "./playerInventory.js";
import { normalizeOwnerKey } from "./survival/campStructures.js";
import type { PersistedPlayerRecord, PersistedWorldFile } from "./survival/persistenceStore.js";
import { SqliteWorldStore } from "./persistence/sqliteWorldStore.js";
import { updatePlayerFogOfWar } from "./survival/playerStepHelper.js";
import { applyPlayerAimInput, buildPlayerSnapshotRecord } from "./survival/playerSurvivalState.js";
import {
  buildFullWorldSaveSnapshot, createInitialSimPlayer, hydratePlayerProfileIfFound, loadWorldPersistence,
  persistPlayerSnapshotRecord, resolveSessionAuth, type SessionAuthResult, type SimPlayer,
} from "./survival/worldPersistenceSync.js";
import { OVERWORLD_ZONE_ID, ZoneManager } from "./zones/zoneManager.js";

export type { SimPlayer } from "./survival/worldPersistenceSync.js";
const TICK_RATE = 20;
const INITIAL_DAY_PHASE = 0.62;
const MAX_QUEUED_COMMANDS = 4096;
export { TICK_RATE };

export class WorldSim {
  readonly zones: ZoneManager;
  readonly hubs: WorldHubCoordinator;
  readonly chat = new ProximityChatManager();
  private readonly activeByAccountId = new Map<string, string>();
  private readonly commandQueue: (() => void)[] = [];
  private readonly persistence: SqliteWorldStore;
  private readonly savedProfiles: Map<string, PersistedPlayerRecord>;
  private lastSavedDeltaRev = 0;
  private nextPlayerNum = 1;
  tick = 0;
  worldClockSec = 0;
  dayPhase = INITIAL_DAY_PHASE;
  dayPaused = false;

  get cache(): WorldChunkCache { return this.zones.defaultZone.cache; }
  get combat(): CombatWorld { return this.zones.defaultZone.combat; }
  private get players(): Map<string, SimPlayer> { return this.zones.defaultZone.players; }

  constructor(readonly worldSeed = 1337, options?: { readonly persistencePath?: string | undefined; readonly maxClients?: number | undefined }) {
    const maxCachedChunks = Math.max(512, (options?.maxClients ?? 32) * 16);
    this.zones = new ZoneManager({ worldSeed, maxCachedChunks });
    this.hubs = new WorldHubCoordinator(worldSeed);
    this.persistence = new SqliteWorldStore(options?.persistencePath);
    this.savedProfiles = loadWorldPersistence({ store: this.persistence, worldSeed, onHydrate: (file) => this.hydrateWorldFile(file) });
    attachHubCombatHooks({ combat: this.combat, hubs: this.hubs, playerForId: (id) => this.players.get(id) });
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

  private persistPlayer(p: SimPlayer, evictIfPersisted = false): void {
    persistPlayerSnapshotRecord({
      host: { savedProfiles: this.savedProfiles, store: this.persistence },
      player: p,
      discovery: this.combat.discovery.snapshotFor(p.id),
      hubExtras: this.hubs.exportAccountExtras(p.accountId),
      evictIfPersisted,
    });
  }

  offlineProfileCount(): number { return this.savedProfiles.size; }
  closePersistence(): void { this.persistence.close(); }

  authenticateSession(req?: { readonly accountId?: string | undefined; readonly resumeToken?: string | undefined }): SessionAuthResult {
    return resolveSessionAuth({ savedProfiles: this.savedProfiles, store: this.persistence, ...req });
  }

  private activatePlayer(player: SimPlayer, accountId: string, persistNew: boolean): void {
    this.zones.assignPlayer(player, OVERWORLD_ZONE_ID);
    this.activeByAccountId.set(accountId, player.id);
    hydratePlayerProfileIfFound({
      host: { savedProfiles: this.savedProfiles, store: this.persistence },
      player,
      onHydrateDiscovery: (id, d) => this.combat.discovery.hydratePlayer(id, d),
      onHydrateHubs: (acct, saved) => this.hubs.hydrateAccount(acct, saved),
    });
    updatePlayerFogOfWar(player, this.dayPhase);
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
      this.persistPlayer(p, true);
      this.combat.pushEvent({ kind: "playerLeave", x: p.x, y: p.y, actorId: p.id });
    }
    this.chat.removePlayer(playerId);
    this.zones.removePlayer(playerId);
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
    const u = craftPlayerRecipe(p.inventory, {
      recipeId,
      nearCampfire: isPlayerNearCampfire(this.cache, p),
      nearWorkbench: isPlayerNearWorkbench(this.cache, p),
    });
    if (!u) return false;
    p.inventory = u; this.persistPlayer(p); return true;
  }
  placeStructure(playerId: string, req: { readonly itemId: string; readonly x: number; readonly y: number; readonly rotation?: number | undefined }): boolean {
    const p = this.players.get(playerId);
    const ok = p ? this.combat.placeStructure({ player: p, playerName: p.name, accountId: p.accountId, ...req }) : false;
    if (p && ok) this.persistPlayer(p);
    return ok;
  }
  dismantleStructure(playerId: string, structureId: string): boolean {
    const p = this.players.get(playerId);
    const ok = p ? this.combat.dismantleStructure({ player: p, playerName: p.name, accountId: p.accountId, structureId }) : false;
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
  handleHubMessage(playerId: string, msg: ClientMessage): boolean {
    const p = this.players.get(playerId);
    if (!p) return false;
    const ev: WorldEvent[] = [];
    const mut = this.hubs.handleMessage({ msg, player: p, cache: this.cache, events: ev });
    for (const e of ev) this.combat.pushEvent(e);
    if (mut) this.persistPlayer(p);
    return mut;
  }
  drainFogDeltas(playerId: string): FogChunkDelta[] { const p = this.players.get(playerId); return p ? p.pendingFogDeltas.splice(0) : []; }
  fullFogDeltas(playerId: string): FogChunkDelta[] { const p = this.players.get(playerId); if (!p) return []; p.pendingFogDeltas.splice(0); return exportAllFogDeltas(p.fog); }
  pickupLoot(playerId: string, lootId?: string): void { const p = this.players.get(playerId); if (p && this.combat.pickupLoot(p, lootId)) this.persistPlayer(p); }
  dropItem(playerId: string, req: DropItemRequest): void { const p = this.players.get(playerId); if (p && this.combat.dropPlayerItem(p, req)) this.persistPlayer(p); }
  inventorySnapshot(playerId: string): InventorySnapshot | undefined {
    const p = this.players.get(playerId);
    return p ? buildInventorySnapshot({ state: p.inventory, selectedHotbar: p.selectedHotbar, gold: p.gold, nearCampfire: isPlayerNearCampfire(this.cache, p), nearWorkbench: isPlayerNearWorkbench(this.cache, p), ackSeq: p.lastActionAckSeq }) : undefined;
  }
  enqueueCommand(cmd: () => void): void { if (this.commandQueue.length < MAX_QUEUED_COMMANDS) this.commandQueue.push(cmd); }
  drainCommands(): void { if (this.commandQueue.length === 0) return; for (const cmd of this.commandQueue.splice(0)) cmd(); }
  step(dtSeconds = 1 / TICK_RATE): void {
    this.drainCommands(); this.tick += 1; this.worldClockSec += dtSeconds;
    if (!this.dayPaused) this.dayPhase = wrapDayPhase(this.dayPhase + dtSeconds / DAY_DURATION_SECONDS);
    this.chat.step(dtSeconds);
    if (this.zones.stepActiveZones({ dtSeconds, dayPhase: this.dayPhase, worldClockSec: this.worldClockSec })) this.persistence.markDirty();
    if (this.cache.deltaRevision() !== this.lastSavedDeltaRev) { this.lastSavedDeltaRev = this.cache.deltaRevision(); this.persistence.markDirty(); }
    this.persistence.maybeFlush(Date.now(), () => this.buildSaveSnapshot());
  }
  combatSnapshots(redactUnopened = false): { readonly projectiles: ProjectileSnapshot[]; readonly entities: WorldEntitySnapshot[]; readonly chests: WorldChestSnapshot[]; readonly groundLoot: GroundLootSnapshot[]; readonly webs?: WorldWebSnapshot | undefined } { return this.combat.snapshots(redactUnopened); }
  drainCombatEvents(): WorldEvent[] { return this.combat.drainEvents(); }
  snapshots(): PlayerSnapshot[] {
    return Array.from(this.players.values(), (p) => {
      const bed = this.combat.structures.respawnPointFor(p.accountId);
      return buildPlayerSnapshotRecord(p, { hasBedRespawn: bed !== null, ...(bed ? { respawnBedPos: { x: bed.x, y: bed.y } } : {}), bubble: this.chat.activeBubbleFor(p.id), cache: this.cache, gold: p.gold });
    });
  }
}
