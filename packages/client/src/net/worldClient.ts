/** Authoritative multiplayer WebSocket client with auto-reconnect, lifecycle probes, and input throttling. */
import { AI_TUNING, CHAT_BUBBLE_DURATION_SEC, DEFAULT_APPEARANCE, PROTOCOL_VERSION, SANCTUARY_CENTER, WorldChunkCache, wrapDayPhase, type ArmorSlotKey, type CharacterAppearance, type ChatEntry, type ClientMessage, type DropItemRequest, type EntityKind, type GroundLootSnapshot, type InventorySnapshot, type PlayerSnapshot, type ProjectileSnapshot, type ServerMessage, type WorldChestSnapshot, type WorldEntitySnapshot, type WorldEvent, type WorldWebSnapshot } from "@dc2d/engine";
import { loadCharacterPrefs, sanitizeCharacterName, saveCharacterPrefs } from "./characterPrefs.js";
import { applyChestTakeAll, applyChestTransfer, applyCraftRecipe, applyDropToClientState, applyEquipArmor, applyMoveSlot, applySelectHotbar, applyUnequipArmor, applyUseItemClient, createStarterInventorySnapshot, findNearestChest, heldItemForInventory } from "./clientInventory.js";
import { LocalSwingTracker } from "./localSwingTracker.js";
import { RemotePlayerSmoother } from "./remoteInterp.js";
import { INITIAL_INPUT_SEND_STATE, bindPageLifecycle, closeSocketSafely, nextReconnectDelayMs, prepareAdminDispatch, resetDisconnectedPlayer, smoothPingRtt, type AdminSendRequest, type ConnectionMode, type InputSendState, type StepInputFrame, type WorldViewState } from "./worldClientHelpers.js";
import { applyServerSnapshotMessage, attachWorldWebSocket, buildLocalChatDispatch, buildPlayersForSnapshot, createIdleGates, mutateChestEntry, parseServerMessage, resolvedAppearance, stepWorldClientInput, type StepLoopMutable } from "./socket/worldClientSocket.js";
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
  private connectTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private probeTimer: number | null = null;
  private sendState: InputSendState = INITIAL_INPUT_SEND_STATE;

  constructor(wsUrl = defaultWsUrl(), opts?: { readonly autoConnect?: boolean }) {
    this.wsUrl = wsUrl;
    this.localPlayer = createDefaultPlayer("local", loadCharacterPrefs());
    bindPageLifecycle({ onUnload: () => this.disconnect(), onResume: () => this.handleResume() });
    if (opts?.autoConnect) this.connect();
  }

  connect(): void {
    if (this.ws || this.mode === "connecting") return;
    this.shouldReconnect = true; this.manualDisconnect = false; this.clearTimer("reconnectTimer");
    this.mode = this.reconnectAttempt > 0 ? "reconnecting" : "connecting"; this.openSocket(this.wsUrl);
  }
  reconnectNow(): void {
    if (this.mode === "idle" && !this.shouldReconnect) { this.connect(); return; }
    this.manualDisconnect = false; this.shouldReconnect = true; this.reconnectAttempt = 0;
    this.clearSocketTimers(); this.closeSocketQuietly("reconnect now"); this.mode = "connecting"; this.openSocket(this.wsUrl);
  }
  disconnect(): void {
    this.manualDisconnect = true; this.shouldReconnect = false; this.reconnectAttempt = 0;
    this.clearSocketTimers(); this.closeSocketQuietly("client disconnect"); this.localPlayerId = "local"; this.remotePlayers = [];
    this.remoteSmoother.setTargets([], "local"); this.resetStreamState(true); this.mode = "idle";
  }

  private closeSocketQuietly(reason?: string): void { closeSocketSafely(this.ws, reason); this.ws = null; }

  private handleResume(): void {
    if (this.manualDisconnect || !this.shouldReconnect) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) { this.reconnectNow(); return; }
    const sentAt = performance.now();
    this.send({ t: "ping", t0: sentAt });
    this.clearTimer("probeTimer");
    this.probeTimer = window.setTimeout(() => {
      this.probeTimer = null;
      if (this.lastServerMsgAtMs < sentAt && !this.manualDisconnect && this.shouldReconnect) this.reconnectNow();
    }, RESUME_PROBE_MS);
  }
  private openSocket(url: string): void {
    const ws = attachWorldWebSocket({
      url, isCurrent: (s) => this.ws === s, onOpen: () => this.sendHello(),
      onMessage: (raw) => this.handleMessage(raw), onDrop: () => this.handleSocketDrop(),
    });
    if (!ws) return;
    this.ws = ws;
    this.connectTimer = window.setTimeout(() => { if (this.ws === ws && this.mode !== "server") this.handleSocketDrop(); }, HANDSHAKE_TIMEOUT_MS);
  }
  private sendHello(): void { this.send({ t: "hello", version: PROTOCOL_VERSION, name: this.localPlayer.name, appearance: this.localPlayer.appearance ?? DEFAULT_APPEARANCE }); }
  private clearTimer(key: "connectTimer" | "reconnectTimer" | "probeTimer"): void { const id = this[key]; if (id !== null) { window.clearTimeout(id); this[key] = null; } }
  private clearSocketTimers(): void { this.clearTimer("connectTimer"); this.clearTimer("reconnectTimer"); this.clearTimer("probeTimer"); }
  private resetStreamState(resetId: boolean): void {
    this.entities = []; this.projectiles = []; this.webs = undefined;
    this.localBowDrawing = false; this.selfAdmin = false; this.pingMs = null; this.pingTimerSec = 0;
    this.sendState = INITIAL_INPUT_SEND_STATE; this.localPlayer = resetDisconnectedPlayer(this.localPlayer, resetId);
  }
  private handleSocketDrop(): void {
    this.clearSocketTimers(); this.closeSocketQuietly(); this.resetStreamState(false);
    const retry = !this.manualDisconnect && this.shouldReconnect; this.mode = retry ? "reconnecting" : "idle";
    if (!retry || this.reconnectTimer !== null) return;
    this.reconnectTimer = window.setTimeout(() => { this.reconnectTimer = null; this.connect(); }, nextReconnectDelayMs(this.reconnectAttempt++));
  }
  private handleMessage(raw: string): void {
    const msg = parseServerMessage(raw);
    if (!msg) return;
    this.lastServerMsgAtMs = performance.now(); this.clearTimer("probeTimer");
    if (msg.t === "welcome") { this.applyWelcome(msg); return; }
    if (msg.t === "pong") { this.pingMs = smoothPingRtt(this.pingMs, performance.now() - msg.t0); return; }
    this.applySnapshot(msg);
  }
  private applySnapshot(msg: Extract<ServerMessage, { t: "snapshot" }>): void {
    const target = {
      gates: this.gates, dayPhase: this.dayPhase, dayPaused: this.dayPaused, selfAdmin: this.selfAdmin,
      inventory: this.inventory, localPlayer: this.localPlayer, remotePlayers: this.remotePlayers,
      localPlayerId: this.localPlayerId, localBowDrawing: this.localBowDrawing, remoteSmoother: this.remoteSmoother,
      projectiles: this.projectiles, entities: this.entities, groundLoot: this.groundLoot, webs: this.webs,
      chests: this.chests, cache: this.cache, queuedEvents: this.queuedEvents, queuedChat: this.queuedChat, swing: this.swing,
    };
    applyServerSnapshotMessage(target, msg);
    this.dayPhase = target.dayPhase; this.dayPaused = target.dayPaused; this.selfAdmin = target.selfAdmin;
    this.inventory = target.inventory; this.localPlayer = target.localPlayer; this.remotePlayers = target.remotePlayers;
    this.projectiles = target.projectiles; this.entities = target.entities; this.groundLoot = target.groundLoot;
    this.webs = target.webs; this.chests = target.chests; this.queuedEvents = target.queuedEvents;
  }
  private applyWelcome(msg: Extract<ServerMessage, { t: "welcome" }>): void {
    this.clearSocketTimers(); this.mode = "server"; this.reconnectAttempt = 0;
    this.localPlayerId = msg.playerId; this.localPlayer = { ...this.localPlayer, id: msg.playerId };
    this.gates = createIdleGates(); this.cache = new WorldChunkCache(msg.worldSeed);
    this.dayPhase = msg.dayPhase; this.dayPaused = msg.dayPaused;
    this.pingTimerSec = 0; this.send({ t: "ping", t0: performance.now() });
  }
  localPose(): { readonly x: number; readonly y: number; readonly elevation: number } { return this.localPlayer; }

  stepInput(input: StepInputFrame): void {
    const state: StepLoopMutable = {
      player: this.localPlayer, attackFlashTimer: this.attackFlashTimer, bubbleTimer: this.localBubbleTimer,
      pingTimerSec: this.pingTimerSec, seq: this.seq, sendState: this.sendState, bowDrawing: this.localBowDrawing,
    };
    stepWorldClientInput({
      state, isServer: this.mode === "server", cache: this.cache, dayPhase: this.dayPhase, inventory: this.inventory,
      swing: this.swing, smoother: this.remoteSmoother, queuedEvents: this.queuedEvents, send: (m) => this.send(m),
    }, input);
    this.localPlayer = state.player; this.attackFlashTimer = state.attackFlashTimer; this.localBubbleTimer = state.bubbleTimer;
    this.pingTimerSec = state.pingTimerSec; this.seq = state.seq; this.sendState = state.sendState; this.localBowDrawing = state.bowDrawing;
  }

  setCharacter(req: { readonly name: string; readonly appearance: CharacterAppearance }): void {
    const name = sanitizeCharacterName(req.name);
    this.localPlayer = { ...this.localPlayer, name, appearance: req.appearance }; saveCharacterPrefs({ name, appearance: req.appearance });
    const seq = this.nextSeq();
    if (seq > 0) this.gates.appearance = { pendingSeq: seq, atMs: performance.now() };
    this.send({ t: "setAppearance", name, appearance: req.appearance, seq });
  }

  toggleTorch(): void { this.localPlayer = { ...this.localPlayer, torchLit: !this.localPlayer.torchLit }; const seq = this.nextSeq(); this.gates.torch = { pendingSeq: seq, atMs: performance.now() }; this.send({ t: "toggleTorch", seq }); }
  respawn(): void {
    const seq = this.nextSeq();
    if (this.mode === "server") { this.send({ t: "respawn", seq }); return; }
    this.localPlayer = { ...this.localPlayer, x: SANCTUARY_CENTER.x, y: SANCTUARY_CENTER.y, elevation: 0, hp: this.localPlayer.maxHp ?? 100, stamina: this.localPlayer.maxStamina ?? 100 };
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
  craftRecipe(recipeId: string): void { this.updateInventory(applyCraftRecipe(this.inventory, recipeId)); this.send({ t: "craft", recipeId, seq: this.armInvSeq() }); }
  nearestChest(radius: number = AI_TUNING.chestInteractRadiusTiles): WorldChestSnapshot | undefined { return findNearestChest(this.chests, this.localPlayer, radius); }
  openChest(chestId: string): void { this.chests = this.chests.map((c) => (c.id === chestId ? { ...c, opened: true } : c)); this.send({ t: "openChest", chestId, seq: this.armChestSeq() }); }
  chestTransfer(req: { readonly chestId: string; readonly from: "chest" | "inv"; readonly fromSlot: number; readonly to: "chest" | "inv"; readonly toSlot: number; readonly quick?: boolean | undefined }): void {
    const next = mutateChestEntry(this.chests, req.chestId, (chest) => applyChestTransfer({ inv: this.inventory, chest, ...req }));
    if (next) { this.updateInventory(next.inv); this.chests = next.chests; }
    this.send({ t: "chestTransfer", ...req, seq: this.armChestSeq() });
  }
  chestTakeAll(chestId: string): void {
    const next = mutateChestEntry(this.chests, chestId, (chest) => applyChestTakeAll({ inv: this.inventory, chest }));
    if (next) { this.updateInventory(next.inv); this.chests = next.chests; }
    this.send({ t: "chestTakeAll", chestId, seq: this.armChestSeq() });
  }
  debugSpawn(kind: EntityKind, count = 1): void { this.send({ t: "debugSpawn", kind, count, seq: this.nextSeq() }); }
  sendAdmin(req: AdminSendRequest): void {
    const out = prepareAdminDispatch({ req, localPlayer: this.localPlayer, isServer: this.mode === "server", isAdmin: this.selfAdmin, seq: this.nextSeq() });
    this.localPlayer = out.nextPlayer; this.send(out.message);
  }
  placeStructure(req: { readonly itemId: string; readonly x: number; readonly y: number }): void { this.send({ t: "placeStructure", ...req, seq: this.armInvSeq() }); }
  setRespawnBed(structureId: string): void { this.send({ t: "setRespawnBed", structureId, seq: this.nextSeq() }); }
  pickupLoot(lootId?: string): void { this.send({ t: "pickupLoot", ...(lootId ? { lootId } : {}), seq: this.armInvSeq() }); }
  dropItem(req: DropItemRequest): void {
    const next = applyDropToClientState({ inv: this.inventory, chests: this.chests, req });
    this.updateInventory(next.inv); this.chests = [...next.chests];
    this.send({ t: "dropItem", ...req, seq: req.source === "chest" ? this.armChestSeq() : this.armInvSeq() });
  }
  useItem(slotIndex: number): void {
    this.updateInventory(applyUseItemClient(this.inventory, slotIndex));
    this.send({ t: "useItem", slotIndex, seq: this.armInvSeq() });
  }
  sendChat(rawText: string, shout = false): void {
    const out = buildLocalChatDispatch({ rawText, shout, durationSec: CHAT_BUBBLE_DURATION_SEC, player: this.localPlayer });
    if (!out) return;
    if (this.mode === "server") { this.send({ t: "chat", text: out.clean, ...(shout ? { shout: true } : {}), seq: this.nextSeq() }); return; }
    this.localBubbleTimer = CHAT_BUBBLE_DURATION_SEC; this.localPlayer = out.echo.player; this.queuedChat.push(out.echo.entry);
  }
  snapshot(): WorldViewState {
    const players = buildPlayersForSnapshot({ isServer: this.mode === "server", remotePlayers: this.remotePlayers, localPlayer: this.localPlayer, localPlayerId: this.localPlayerId, inventory: this.inventory, swing: this.swing, smoother: this.remoteSmoother });
    const events = this.queuedEvents; this.queuedEvents = []; const chatMessages = this.queuedChat; this.queuedChat = [];
    return {
      mode: this.mode, reconnectAttempt: this.reconnectAttempt, dayPhase: this.dayPhase, dayPaused: this.dayPaused, cache: this.cache,
      players, localPlayerId: this.localPlayerId, inventory: this.inventory, localName: this.localPlayer.name,
      localAppearance: resolvedAppearance(this.localPlayer), projectiles: this.projectiles, entities: this.entities,
      chests: this.chests, groundLoot: this.groundLoot, webs: this.webs, events, ...(chatMessages.length > 0 ? { chatMessages } : {}),
      selfAdmin: this.selfAdmin, pingMs: this.pingMs,
    };
  }
  private nextSeq(): number { return this.mode === "server" ? ++this.actionSeq : 0; }
  private armInvSeq(): number { const seq = this.nextSeq(); if (seq > 0) this.gates.inv = { pendingSeq: seq, atMs: performance.now() }; return seq; }
  private armChestSeq(): number { const seq = this.armInvSeq(); if (seq > 0) this.gates.chest = { pendingSeq: seq, atMs: performance.now() }; return seq; }
  private updateInventory(next: InventorySnapshot): void { this.inventory = next; this.localPlayer = { ...this.localPlayer, heldItem: heldItemForInventory(next) }; }
  private send(msg: ClientMessage): void { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg)); }
}
