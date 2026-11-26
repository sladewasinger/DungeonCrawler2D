/** Authoritative multiplayer WebSocket client with auto-reconnect, lifecycle probes, and input throttling. */
import { AI_TUNING, WorldChunkCache, wrapDayPhase, type ArmorSlotKey, type CharacterAppearance, type ChatEntry, type ClientMessage, type DiscoveryStateSnapshot, type DropItemRequest, type EntityKind, type GroundLootSnapshot, type InventorySnapshot, type PlayerSnapshot, type ProjectileSnapshot, type ServerMessage, type WorldChestSnapshot, type WorldEntitySnapshot, type WorldEvent, type WorldWebSnapshot } from "@dc2d/engine";
import { loadCharacterPrefs, readStoredAuthToken, writeStoredAuthToken } from "./characterPrefs.js";
import {
  applyCraftRecipe, applyEquipArmor, applyMoveSlot, applySelectHotbar, applyUnequipArmor,
  createStarterInventorySnapshot, findNearestChest, heldItemForInventory,
} from "./clientInventory.js";
import { LocalSwingTracker } from "./localSwingTracker.js";
import {
  createClientHubState, createHubActionClient, resetClientHubState, tryOfflineAdminMutation,
  type ClientHubState, type HubActionClient,
} from "./hubClientBridge.js";
import { OfflineWorldController, type OfflineStateSlice } from "./offline/offlineWorldController.js";
import { RemotePlayerSmoother } from "./remoteInterp.js";
import { INITIAL_INPUT_SEND_STATE, bindPageLifecycle, closeSocketSafely, prepareAdminDispatch, smoothPingRtt, type AdminSendRequest, type ConnectionMode, type InputSendState, type StepInputFrame, type WorldViewState } from "./worldClientHelpers.js";
import { createIdleGates, parseServerMessage, type StepLoopMutable } from "./socket/worldClientSocket.js";
import {
  dispatchCharacterAppearance, dispatchChatAction, dispatchChestTakeAllAction,
  dispatchChestTransferAction, dispatchDropAction, dispatchUseItemAction,
} from "./socket/worldClientOps.js";
import {
  applyClientStructureAction, applyWelcomeState, buildClientViewSnapshot, buildDisconnectedStreamReset, clearAllManagedTimers,
  clearManagedTimer, dispatchSnapshotToTarget, openManagedClientSocket, runStepWorldClientFrame,
  scheduleClientReconnect, scheduleClientResumeProbe, type TimerSlotKey,
} from "./socket/worldClientView.js";
import { createDefaultPlayer, defaultWsUrl } from "./worldPrediction.js";

export type { ConnectionMode, StepInputFrame, WorldViewState } from "./worldClientHelpers.js";

const INITIAL_DAY_PHASE = 0.62;
const HANDSHAKE_TIMEOUT_MS = 6000;
const RESUME_PROBE_MS = 2200;

export class WorldClient {
  private readonly wsUrl: string;
  private ws: WebSocket | null = null;
  private mode: ConnectionMode = "idle";
  private cache = new WorldChunkCache(1337);
  private localPlayerId = "local";
  private dayPhase = INITIAL_DAY_PHASE;
  private dayPaused = false;
  private seq = 0;
  private actionSeq = 0;
  private gates = createIdleGates();
  private localPlayer: PlayerSnapshot;
  private remotePlayers: PlayerSnapshot[] = [];
  private projectiles: readonly ProjectileSnapshot[] = [];
  private entities: readonly WorldEntitySnapshot[] = [];
  private chests: readonly WorldChestSnapshot[] = [];
  private groundLoot: readonly GroundLootSnapshot[] = [];
  private webs: WorldWebSnapshot | undefined;
  private discovery: DiscoveryStateSnapshot | undefined;
  private queuedEvents: WorldEvent[] = [];
  private queuedChat: ChatEntry[] = [];
  private localBubbleTimer = 0;
  private readonly remoteSmoother = new RemotePlayerSmoother();
  private readonly swing = new LocalSwingTracker();
  private localBowDrawing = false;
  private attackFlashTimer = 0;
  private inventory: InventorySnapshot = createStarterInventorySnapshot();
  private selfAdmin = false;
  private pingMs: number | null = null;
  private pingTimerSec = 0;
  private shouldReconnect = false;
  private manualDisconnect = false;
  private reconnectAttempt = 0;
  private lastServerMsgAtMs = 0;
  private readonly timers: Record<TimerSlotKey, number | null> = { connect: null, reconnect: null, probe: null };
  private sendState: InputSendState = INITIAL_INPUT_SEND_STATE;
  private readonly offlineOnly: boolean;
  private readonly offline = new OfflineWorldController();
  private readonly hub: ClientHubState = createClientHubState(1337);
  private hubActionsCache: HubActionClient | null = null;

  constructor(wsUrl = defaultWsUrl(), opts?: { readonly autoConnect?: boolean; readonly offlineOnly?: boolean }) {
    this.wsUrl = wsUrl; this.offlineOnly = Boolean(opts?.offlineOnly);
    this.localPlayer = createDefaultPlayer("local", loadCharacterPrefs());
    const saved = this.offlineOnly ? this.offline.loadSaved(this.offlineSlice()) : null;
    if (saved) {
      this.dayPhase = saved.dayPhase;
      this.localPlayer = saved.player;
      this.chests = saved.chests;
      this.updateInventory(saved.inventory);
    }
    bindPageLifecycle({ onUnload: () => this.handlePageUnload(), onResume: () => this.handleResume() });
    if (opts?.autoConnect && !this.offlineOnly) this.connect();
  }

  private handlePageUnload(): void {
    if (this.mode !== "server") this.offline.flushNow(this.offlineSlice());
    this.disconnect();
  }
  isOfflineOnly(): boolean { return this.offlineOnly; }
  private offlineSlice(): OfflineStateSlice {
    return { cache: this.cache, dayPhase: this.dayPhase, player: this.localPlayer, inventory: this.inventory, chests: this.chests, events: this.queuedEvents, hub: this.hub };
  }
  resetOfflineWorld(): void {
    const res = this.offline.reset(this.cache.worldSeed, this.localPlayer);
    this.cache = res.cache;
    this.localPlayer = res.player;
    this.chests = [];
    this.groundLoot = [];
    this.queuedEvents = [];
    resetClientHubState(this.hub, this.cache.worldSeed);
    this.updateInventory(res.inventory);
  }
  connect(): void {
    if (this.ws || this.mode === "connecting") return;
    this.shouldReconnect = true; this.manualDisconnect = false; clearManagedTimer(this.timers, "reconnect");
    this.mode = this.reconnectAttempt > 0 ? "reconnecting" : "connecting"; this.openSocket(this.wsUrl);
  }
  private dropSocket(reason: string): void { clearAllManagedTimers(this.timers); closeSocketSafely(this.ws, reason); this.ws = null; }
  reconnectNow(): void {
    if (this.mode === "idle" && !this.shouldReconnect) { this.connect(); return; }
    this.manualDisconnect = false; this.shouldReconnect = true; this.reconnectAttempt = 0;
    this.dropSocket("reconnect now"); this.mode = "connecting"; this.openSocket(this.wsUrl);
  }
  disconnect(): void {
    this.manualDisconnect = true; this.shouldReconnect = false; this.reconnectAttempt = 0;
    this.dropSocket("client disconnect"); this.localPlayerId = "local"; this.remotePlayers = [];
    this.remoteSmoother.setTargets([], "local"); this.resetStreamState(true); this.mode = "idle";
  }
  private handleResume(): void {
    if (this.manualDisconnect || !this.shouldReconnect) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) { this.reconnectNow(); return; }
    scheduleClientResumeProbe({
      timers: this.timers, probeMs: RESUME_PROBE_MS, sendPing: (t0) => this.send({ t: "ping", t0 }),
      isStale: (t0) => this.lastServerMsgAtMs < t0 && !this.manualDisconnect && this.shouldReconnect, onStale: () => this.reconnectNow(),
    });
  }
  private openSocket(url: string): void {
    const ws = openManagedClientSocket({
      url, isCurrent: (s) => this.ws === s, getHelloCtx: () => ({ player: this.localPlayer, auth: readStoredAuthToken() }),
      onMessage: (raw) => this.handleMessage(raw), onDrop: () => this.handleSocketDrop(),
      onHandshakeTimeout: (s) => { if (this.ws === s && this.mode !== "server") this.handleSocketDrop(); },
      timers: this.timers, timeoutMs: HANDSHAKE_TIMEOUT_MS,
    });
    if (ws) this.ws = ws;
  }
  private resetStreamState(resetId: boolean): void {
    const r = buildDisconnectedStreamReset(this.localPlayer, resetId, INITIAL_INPUT_SEND_STATE);
    this.entities = r.entities; this.projectiles = r.projectiles; this.webs = r.webs; this.localBowDrawing = r.localBowDrawing;
    this.selfAdmin = r.selfAdmin; this.pingMs = r.pingMs; this.pingTimerSec = r.pingTimerSec;
    this.sendState = r.sendState; this.localPlayer = r.localPlayer;
  }
  private handleSocketDrop(): void {
    this.dropSocket("drop"); this.resetStreamState(false);
    const retry = !this.manualDisconnect && this.shouldReconnect;
    this.mode = retry ? "reconnecting" : "idle";
    this.reconnectAttempt = scheduleClientReconnect({ timers: this.timers, retry, attempt: this.reconnectAttempt, onConnect: () => this.connect() });
  }
  private handleMessage(raw: string): void {
    const msg = parseServerMessage(raw);
    if (!msg) return;
    this.lastServerMsgAtMs = performance.now(); clearManagedTimer(this.timers, "probe");
    if (msg.t === "welcome") this.applyWelcome(msg);
    else if (msg.t === "pong") this.pingMs = smoothPingRtt(this.pingMs, performance.now() - msg.t0);
    else this.applySnapshot(msg);
  }
  private applySnapshot(msg: Extract<ServerMessage, { t: "snapshot" }>): void {
    const t = dispatchSnapshotToTarget({ gates: this.gates, dayPhase: this.dayPhase, dayPaused: this.dayPaused, selfAdmin: this.selfAdmin, inventory: this.inventory, localPlayer: this.localPlayer, remotePlayers: this.remotePlayers, localPlayerId: this.localPlayerId, localBowDrawing: this.localBowDrawing, remoteSmoother: this.remoteSmoother, projectiles: this.projectiles, entities: this.entities, groundLoot: this.groundLoot, webs: this.webs, chests: this.chests, cache: this.cache, queuedEvents: this.queuedEvents, queuedChat: this.queuedChat, swing: this.swing, discovery: this.discovery, hub: this.hub }, msg);
    this.dayPhase = t.dayPhase; this.dayPaused = t.dayPaused; this.selfAdmin = t.selfAdmin; this.inventory = t.inventory;
    this.localPlayer = t.localPlayer; this.remotePlayers = t.remotePlayers; this.projectiles = t.projectiles;
    this.entities = t.entities; this.groundLoot = t.groundLoot; this.webs = t.webs;
    this.chests = t.chests; this.queuedEvents = t.queuedEvents; this.discovery = t.discovery;
  }
  private applyWelcome(msg: Extract<ServerMessage, { t: "welcome" }>): void {
    clearAllManagedTimers(this.timers); this.mode = "server"; this.reconnectAttempt = 0; this.pingTimerSec = 0;
    const w = applyWelcomeState({ msg, localPlayer: this.localPlayer, saveToken: writeStoredAuthToken });
    this.localPlayerId = w.playerId; this.localPlayer = w.localPlayer; this.gates = w.gates; this.cache = w.cache;
    this.dayPhase = w.dayPhase; this.dayPaused = w.dayPaused; resetClientHubState(this.hub, msg.worldSeed); this.send({ t: "ping", t0: performance.now() });
  }
  localPose(): { readonly x: number; readonly y: number; readonly elevation: number } { return this.localPlayer; }
  stepInput(input: StepInputFrame): void {
    const state: StepLoopMutable = { player: this.localPlayer, attackFlashTimer: this.attackFlashTimer, bubbleTimer: this.localBubbleTimer, pingTimerSec: this.pingTimerSec, seq: this.seq, sendState: this.sendState, bowDrawing: this.localBowDrawing };
    const next = runStepWorldClientFrame({ state, mode: this.mode, offlineOnly: this.offlineOnly, cache: this.cache, dayPhase: this.dayPhase, inventory: this.inventory, swing: this.swing, smoother: this.remoteSmoother, queuedEvents: this.queuedEvents, send: (m) => this.send(m), input, offline: this.offline, offlineSlice: () => this.offlineSlice() });
    this.localPlayer = next.player; this.inventory = next.inventory;
    this.attackFlashTimer = state.attackFlashTimer; this.localBubbleTimer = state.bubbleTimer;
    this.pingTimerSec = state.pingTimerSec; this.seq = state.seq; this.sendState = state.sendState; this.localBowDrawing = state.bowDrawing;
  }

  setCharacter(req: { readonly name: string; readonly appearance: CharacterAppearance }): void {
    const out = dispatchCharacterAppearance({ req, localPlayer: this.localPlayer, seq: this.nextSeq(), send: (m) => this.send(m) });
    this.localPlayer = out.player;
    if (out.gate) this.gates.appearance = out.gate;
  }

  toggleTorch(): void { this.localPlayer = { ...this.localPlayer, torchLit: !this.localPlayer.torchLit }; const seq = this.nextSeq(); this.gates.torch = { pendingSeq: seq, atMs: performance.now() }; this.send({ t: "toggleTorch", seq }); }
  respawn(): void {
    const seq = this.nextSeq();
    if (this.mode === "server") { this.send({ t: "respawn", seq }); return; }
    this.localPlayer = this.offline.respawn(this.localPlayer);
  }
  setDayPhase(dayPhase: number, paused?: boolean): void {
    this.dayPhase = wrapDayPhase(dayPhase); if (paused !== undefined) this.dayPaused = paused;
    const seq = this.nextSeq(); this.gates.day = { pendingSeq: seq, atMs: performance.now() };
    this.send({ t: "setDayPhase", dayPhase: this.dayPhase, ...(paused !== undefined ? { paused } : {}), seq });
  }
  selectHotbar(slot: number): void { this.updateInventory(applySelectHotbar(this.inventory, slot)); this.send({ t: "selectHotbar", slot, seq: this.armInvSeq() }); }
  moveSlot(move: { readonly from: number; readonly to: number }): void { this.updateInventory(applyMoveSlot(this.inventory, move)); this.send({ t: "moveSlot", from: move.from, to: move.to, seq: this.armInvSeq() }); }
  equipArmor(req: { readonly slotIndex: number; readonly targetArmor?: ArmorSlotKey | undefined }): void { this.updateInventory(applyEquipArmor(this.inventory, req)); this.send({ t: "equipArmor", slotIndex: req.slotIndex, ...(req.targetArmor ? { targetArmor: req.targetArmor } : {}), seq: this.armInvSeq() }); }
  unequipArmor(req: { readonly armorSlot: ArmorSlotKey; readonly targetSlot?: number | undefined }): void { this.updateInventory(applyUnequipArmor(this.inventory, req)); this.send({ t: "unequipArmor", armorSlot: req.armorSlot, ...(req.targetSlot !== undefined ? { targetSlot: req.targetSlot } : {}), seq: this.armInvSeq() }); }
  private commitOfflineInv(next: InventorySnapshot, chests = this.chests): void {
    this.updateInventory(next); this.chests = chests;
    if (this.mode !== "server") this.offline.flushNow(this.offlineSlice());
  }
  craftRecipe(recipeId: string): void { this.commitOfflineInv(applyCraftRecipe(this.inventory, recipeId)); this.send({ t: "craft", recipeId, seq: this.armInvSeq() }); }
  nearestChest(radius: number = AI_TUNING.chestInteractRadiusTiles): WorldChestSnapshot | undefined { return findNearestChest(this.chests, this.localPlayer, radius); }
  openChest(chestId: string): void { this.chests = this.chests.map((c) => (c.id === chestId ? { ...c, opened: true } : c)); this.send({ t: "openChest", chestId, seq: this.armChestSeq() }); }
  chestTransfer(req: { readonly chestId: string; readonly from: "chest" | "inv"; readonly fromSlot: number; readonly to: "chest" | "inv"; readonly toSlot: number; readonly quick?: boolean | undefined }): boolean {
    return dispatchChestTransferAction({ chests: this.chests, inv: this.inventory, req, seq: this.armChestSeq(), commit: (i, c) => this.commitOfflineInv(i, c), send: (m) => this.send(m) });
  }
  chestTakeAll(chestId: string): boolean {
    return dispatchChestTakeAllAction({ chests: this.chests, chestId, inv: this.inventory, seq: this.armChestSeq(), commit: (i, c) => this.commitOfflineInv(i, c), send: (m) => this.send(m) });
  }
  debugSpawn(kind: EntityKind, count = 1): void { this.send({ t: "debugSpawn", kind, count, seq: this.nextSeq() }); }
  private offlineCtx() {
    return { hub: this.hub, inv: this.inventory, player: this.localPlayer, worldSeed: this.cache.worldSeed, events: this.queuedEvents };
  }
  sendAdmin(req: AdminSendRequest): void {
    if (this.mode !== "server" && tryOfflineAdminMutation({ req, offline: this.offline, slice: this.offlineSlice(), commit: (i) => this.commitOfflineInv(i) })) return;
    const out = prepareAdminDispatch({ req, localPlayer: this.localPlayer, isServer: this.mode === "server", isAdmin: this.selfAdmin, seq: this.nextSeq() });
    this.localPlayer = out.nextPlayer; this.send(out.message);
  }
  interactNpc(npcId: string): void { if (this.mode === "server") this.send({ t: "interactNpc", npcId }); }
  hubs(): HubActionClient {
    return (this.hubActionsCache ??= createHubActionClient({
      isServer: () => this.mode === "server", nextSeq: () => this.nextSeq(), send: (m) => this.send(m),
      getOfflineCtx: () => this.offlineCtx(), commitOfflineInv: (inv) => this.commitOfflineInv(inv),
    }));
  }
  private runStruct(req: Parameters<typeof applyClientStructureAction>[0]["req"], seq: number): void {
    applyClientStructureAction({ mode: this.mode, req, seq, send: (m) => this.send(m), offline: this.offline, slice: () => this.offlineSlice(), onResult: (r) => { this.localPlayer = r.player; if (r.inv) this.commitOfflineInv(r.inv, r.chests ?? this.chests); } });
  }
  placeStructure(req: { readonly itemId: string; readonly x: number; readonly y: number; readonly rotation?: number | undefined }): void { this.runStruct({ kind: "place", ...req }, this.armInvSeq()); }
  dismantleStructure(structureId: string): void { this.runStruct({ kind: "dismantle", structureId }, this.armInvSeq()); }
  setRespawnBed(structureId: string): void { this.runStruct({ kind: "bed", structureId }, this.nextSeq()); }
  pickupLoot(lootId?: string): void { this.send({ t: "pickupLoot", ...(lootId ? { lootId } : {}), seq: this.armInvSeq() }); }
  dropItem(req: DropItemRequest): void {
    const seq = req.source === "chest" ? this.armChestSeq() : this.armInvSeq();
    dispatchDropAction({ inv: this.inventory, chests: this.chests, req, seq, commit: (i, c) => this.commitOfflineInv(i, c), send: (m) => this.send(m) });
  }
  useItem(slotIndex: number): void {
    dispatchUseItemAction({ slotIndex, inv: this.inventory, mode: this.mode, seq: this.armInvSeq(), offline: this.offline, slice: () => this.offlineSlice(), updateInv: (n) => this.updateInventory(n), setPlayer: (p) => { this.localPlayer = p; }, send: (m) => this.send(m) });
  }
  sendChat(rawText: string, shout = false): void {
    dispatchChatAction({ rawText, shout, player: this.localPlayer, mode: this.mode, seq: this.nextSeq(), send: (m) => this.send(m), onLocalEcho: (e) => { this.localBubbleTimer = e.bubbleSec; this.localPlayer = e.player; this.queuedChat.push(e.entry); } });
  }
  snapshot(): WorldViewState {
    const events = this.queuedEvents; this.queuedEvents = []; const chatMessages = this.queuedChat; this.queuedChat = [];
    return buildClientViewSnapshot({ mode: this.mode, reconnectAttempt: this.reconnectAttempt, dayPhase: this.dayPhase, dayPaused: this.dayPaused, cache: this.cache, remotePlayers: this.remotePlayers, localPlayer: this.localPlayer, localPlayerId: this.localPlayerId, inventory: this.inventory, swing: this.swing, smoother: this.remoteSmoother, projectiles: this.projectiles, entities: this.entities, chests: this.chests, groundLoot: this.groundLoot, webs: this.webs, events, chatMessages, discovery: this.discovery, hub: this.hub, selfAdmin: this.selfAdmin, pingMs: this.pingMs });
  }
  private nextSeq(): number { return this.mode === "server" ? ++this.actionSeq : 0; }
  private armInvSeq(): number { const seq = this.nextSeq(); if (seq > 0) this.gates.inv = { pendingSeq: seq, atMs: performance.now() }; return seq; }
  private armChestSeq(): number { const seq = this.armInvSeq(); if (seq > 0) this.gates.chest = { pendingSeq: seq, atMs: performance.now() }; return seq; }
  private updateInventory(next: InventorySnapshot): void { this.inventory = next; this.localPlayer = { ...this.localPlayer, heldItem: heldItemForInventory(next) }; }
  private send(msg: ClientMessage): void { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg)); }
}
