/** Authoritative multiplayer WebSocket client with auto-reconnect, lifecycle probes, and input throttling. */
import { AI_TUNING, DEFAULT_APPEARANCE, PROTOCOL_VERSION, SANCTUARY_CENTER, STEALTH_TUNING, ServerMessageSchema, WorldChunkCache, wrapDayPhase, type ArmorSlotKey, type CharacterAppearance, type ClientMessage, type DropItemRequest, type EntityKind, type GroundLootSnapshot, type InventorySnapshot, type PlayerSnapshot, type ProjectileSnapshot, type ServerMessage, type WorldChestSnapshot, type WorldEntitySnapshot, type WorldEvent, type WorldWebSnapshot } from "@dc2d/engine";
import { IDLE_GATE, resolvePendingGate } from "./actionGate.js";
import { loadCharacterPrefs, sanitizeCharacterName, saveCharacterPrefs } from "./characterPrefs.js";
import { applyChestTakeAll, applyChestTransfer, applyCraftRecipe, applyDropToClientState, applyEquipArmor, applyMoveSlot, applySelectHotbar, applyUnequipArmor, createStarterInventorySnapshot, findNearestChest, heldItemForInventory, reconcileInventorySnapshot } from "./clientInventory.js";
import { LocalSwingTracker } from "./localSwingTracker.js";
import { RemotePlayerSmoother } from "./remoteInterp.js";
import { INITIAL_INPUT_SEND_STATE, applyLocalAtmosphere, bindPageLifecycle, buildInputMessage, closeSocketSafely, mergeStreamEvents, nextReconnectDelayMs, prepareAdminDispatch, resetDisconnectedPlayer, shouldSendInputFrame, smoothPingRtt, type AdminSendRequest, type ConnectionMode, type InputSendState, type StepInputFrame, type WorldViewState } from "./worldClientHelpers.js";
import { createDefaultPlayer, defaultWsUrl, normalizeDirection, predictLocalPlayerMove, reconcilePredictedPlayer } from "./worldPrediction.js";

export type { ConnectionMode, StepInputFrame, WorldViewState } from "./worldClientHelpers.js";

const INITIAL_DAY_PHASE = 0.62;
const HANDSHAKE_TIMEOUT_MS = 6000;
const RESUME_PROBE_MS = 2200;
const createIdleGates = () => ({ inv: IDLE_GATE, chest: IDLE_GATE, torch: IDLE_GATE, day: IDLE_GATE, appearance: IDLE_GATE });

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
    this.mode = this.reconnectAttempt > 0 ? "reconnecting" : "connecting";
    this.openSocket(this.wsUrl);
  }

  reconnectNow(): void {
    if (this.mode === "idle" && !this.shouldReconnect) { this.connect(); return; }
    this.manualDisconnect = false; this.shouldReconnect = true; this.reconnectAttempt = 0;
    this.clearSocketTimers(); this.closeSocketQuietly("reconnect now");
    this.mode = "connecting"; this.openSocket(this.wsUrl);
  }

  disconnect(): void {
    this.manualDisconnect = true; this.shouldReconnect = false; this.reconnectAttempt = 0;
    this.clearSocketTimers(); this.closeSocketQuietly("client disconnect");
    this.localPlayerId = "local"; this.remotePlayers = [];
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
    try {
      const ws = new WebSocket(url);
      this.ws = ws;
      this.connectTimer = window.setTimeout(() => { if (this.ws === ws && this.mode !== "server") this.handleSocketDrop(); }, HANDSHAKE_TIMEOUT_MS);
      ws.addEventListener("open", () => { if (this.ws === ws) this.sendHello(); });
      ws.addEventListener("message", (ev) => { if (this.ws === ws) this.handleMessage(String(ev.data)); });
      ws.addEventListener("close", () => { if (this.ws === ws) this.handleSocketDrop(); });
      ws.addEventListener("error", () => { if (this.ws === ws) this.handleSocketDrop(); });
    } catch { this.handleSocketDrop(); }
  }

  private sendHello(): void { this.send({ t: "hello", version: PROTOCOL_VERSION, name: this.localPlayer.name, appearance: this.localPlayer.appearance ?? DEFAULT_APPEARANCE }); }
  private clearTimer(key: "connectTimer" | "reconnectTimer" | "probeTimer"): void { const id = this[key]; if (id !== null) { window.clearTimeout(id); this[key] = null; } }
  private clearSocketTimers(): void { this.clearTimer("connectTimer"); this.clearTimer("reconnectTimer"); this.clearTimer("probeTimer"); }

  private resetStreamState(resetId: boolean): void {
    this.entities = []; this.projectiles = []; this.webs = undefined; this.localBowDrawing = false;
    this.selfAdmin = false; this.pingMs = null; this.pingTimerSec = 0;
    this.sendState = INITIAL_INPUT_SEND_STATE; this.localPlayer = resetDisconnectedPlayer(this.localPlayer, resetId);
  }

  private handleSocketDrop(): void {
    this.clearSocketTimers(); this.closeSocketQuietly(); this.resetStreamState(false);
    const retry = !this.manualDisconnect && this.shouldReconnect;
    this.mode = retry ? "reconnecting" : "idle";
    if (!retry || this.reconnectTimer !== null) return;
    this.reconnectTimer = window.setTimeout(() => { this.reconnectTimer = null; this.connect(); }, nextReconnectDelayMs(this.reconnectAttempt++));
  }

  private handleMessage(raw: string): void {
    let json: unknown; try { json = JSON.parse(raw); } catch { return; }
    const parsed = ServerMessageSchema.safeParse(json);
    if (!parsed.success) return;
    this.lastServerMsgAtMs = performance.now(); this.clearTimer("probeTimer");
    if (parsed.data.t === "welcome") { this.applyWelcome(parsed.data); return; }
    if (parsed.data.t === "pong") { this.pingMs = smoothPingRtt(this.pingMs, performance.now() - parsed.data.t0); return; }
    this.applyServerSnapshot(parsed.data);
  }

  private applyWelcome(msg: Extract<ServerMessage, { t: "welcome" }>): void {
    this.clearSocketTimers(); this.mode = "server"; this.reconnectAttempt = 0;
    this.localPlayerId = msg.playerId; this.localPlayer = { ...this.localPlayer, id: msg.playerId };
    this.gates = createIdleGates(); this.cache = new WorldChunkCache(msg.worldSeed);
    this.dayPhase = msg.dayPhase; this.dayPaused = msg.dayPaused;
    this.pingTimerSec = 0; this.send({ t: "ping", t0: performance.now() });
  }

  private applyServerSnapshot(msg: Extract<ServerMessage, { t: "snapshot" }>): void {
    const nowMs = performance.now(); const serverAck = msg.actionAckSeq ?? msg.selfInventory?.ackSeq ?? 0;
    const dayRes = resolvePendingGate(this.gates.day, { serverAck, nowMs });
    this.gates.day = dayRes.nextGate;
    if (dayRes.accept) { this.dayPhase = msg.dayPhase; this.dayPaused = msg.dayPaused; }
    this.selfAdmin = Boolean(msg.selfAdmin);
    if (msg.selfInventory) this.reconcileServerInventory(msg.selfInventory, serverAck, nowMs);
    this.reconcileServerPlayers({ players: msg.players, serverAck, nowMs });
    this.applyWorldStream(msg, nowMs, serverAck);
  }

  private applyWorldStream(msg: Extract<ServerMessage, { t: "snapshot" }>, nowMs: number, serverAck: number): void {
    this.projectiles = msg.projectiles ?? []; this.entities = msg.entities ?? [];
    this.groundLoot = msg.groundLoot ?? []; this.webs = msg.webs;
    const chestRes = resolvePendingGate(this.gates.chest, { serverAck, nowMs });
    this.gates.chest = chestRes.nextGate;
    if (chestRes.accept && msg.chests) this.chests = msg.chests;
    if (msg.worldDeltas) this.cache.applyWorldDeltaSnapshot(msg.worldDeltas);
    this.queuedEvents = mergeStreamEvents({ current: this.queuedEvents, incoming: msg.events, stripLocalSwing: this.swing.hasPendingServerSwing(), localId: this.localPlayerId, clearPending: () => this.swing.clearPendingServerSwing() });
  }

  private reconcileServerPlayers(opts: { readonly players: readonly PlayerSnapshot[]; readonly serverAck: number; readonly nowMs: number }): void {
    this.remotePlayers = [...opts.players]; this.remoteSmoother.setTargets(opts.players, this.localPlayerId);
    const torchRes = resolvePendingGate(this.gates.torch, { serverAck: opts.serverAck, nowMs: opts.nowMs });
    const appRes = resolvePendingGate(this.gates.appearance, { serverAck: opts.serverAck, nowMs: opts.nowMs });
    this.gates.torch = torchRes.nextGate; this.gates.appearance = appRes.nextGate;
    const me = opts.players.find((p) => p.id === this.localPlayerId);
    if (me) this.localPlayer = reconcilePredictedPlayer(this.localPlayer, me, { preserveTorch: !torchRes.accept, preserveAppearance: !appRes.accept, localBowDrawing: this.localBowDrawing });
  }

  private reconcileServerInventory(incoming: InventorySnapshot, serverAck: number, nowMs: number): void {
    const rec = reconcileInventorySnapshot({ current: this.inventory, incoming: { ...incoming, ackSeq: serverAck }, pendingSeq: this.gates.inv.pendingSeq, elapsedMs: nowMs - this.gates.inv.atMs });
    this.inventory = rec.inventory;
    if (rec.clearedPending) this.gates.inv = IDLE_GATE;
  }

  localPose(): { readonly x: number; readonly y: number; readonly elevation: number } { return this.localPlayer; }

  private stepPingHeartbeat(dt: number, isServer: boolean): void {
    if (!isServer) return;
    this.pingTimerSec += dt;
    if (this.pingTimerSec < 1.0) return;
    this.pingTimerSec = 0; this.send({ t: "ping", t0: performance.now() });
  }

  private stepLocalAtmosphere(dt: number): void {
    this.attackFlashTimer = Math.max(0, this.attackFlashTimer - dt);
    const attackFlash = Boolean(this.localPlayer.attackFlash) || this.attackFlashTimer > 0;
    const isServer = this.mode === "server";
    this.stepPingHeartbeat(dt, isServer);
    this.localPlayer = applyLocalAtmosphere({ cache: this.cache, player: this.localPlayer, dayPhase: this.dayPhase, attackFlash, isServer });
  }

  stepInput(input: StepInputFrame): void {
    const isServer = this.mode === "server";
    const heldId = heldItemForInventory(this.inventory);
    if (!isServer) { this.stepLocalAtmosphere(input.dt); return; }
    const moveDir = normalizeDirection(input.move, true) ?? { x: 0, y: 0 };
    const normAim = normalizeDirection(input.aim, false);
    this.localBowDrawing = Boolean(input.bowDraw) && heldId === "bow";
    this.remoteSmoother.step(input.dt);
    const preEvCount = this.queuedEvents.length;
    this.swing.step({ dt: input.dt, attack: Boolean(input.attack), attackHold: Boolean(input.attackHold), dodge: Boolean(input.dodge), heldId, player: this.localPlayer, normAim, isServer: true, events: this.queuedEvents });
    if (this.queuedEvents.length > preEvCount || input.bowRelease) this.attackFlashTimer = STEALTH_TUNING.attackFlashSec;
    const sendCheck = shouldSendInputFrame({ prev: this.sendState, nowMs: performance.now(), moveDir, normAim, input });
    if (sendCheck.send) { this.sendState = sendCheck.next; this.send(buildInputMessage({ seq: ++this.seq, moveDir, normAim, input })); }
    this.localPlayer = predictLocalPlayerMove({ cache: this.cache, player: { ...this.localPlayer, heldItem: heldId, swingProgress: this.swing.activeProgress(this.localPlayer.swingProgress) }, nx: moveDir.x, ny: moveDir.y, dt: input.dt, aim: normAim, jump: input.jump, crouch: input.crouch, bowDraw: this.localBowDrawing });
    this.stepLocalAtmosphere(input.dt);
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
    const chest = this.chests.find((c) => c.id === req.chestId);
    if (chest) { const next = applyChestTransfer({ inv: this.inventory, chest, ...req }); this.updateInventory(next.inv); this.chests = this.chests.map((c) => (c.id === req.chestId ? next.chest : c)); }
    this.send({ t: "chestTransfer", ...req, seq: this.armChestSeq() });
  }
  chestTakeAll(chestId: string): void {
    const chest = this.chests.find((c) => c.id === chestId);
    if (chest) { const next = applyChestTakeAll({ inv: this.inventory, chest }); this.updateInventory(next.inv); this.chests = this.chests.map((c) => (c.id === chestId ? next.chest : c)); }
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

  snapshot(): WorldViewState {
    const localWithGear: PlayerSnapshot = { ...this.localPlayer, heldItem: heldItemForInventory(this.inventory), armor: this.inventory.armor, ...this.swing.snapshotOverride() };
    const players = this.mode === "server" ? this.remotePlayers.map((p) => (p.id === this.localPlayerId ? localWithGear : this.remoteSmoother.resolve(p))) : [localWithGear];
    const events = this.queuedEvents; this.queuedEvents = [];
    return { mode: this.mode, reconnectAttempt: this.reconnectAttempt, dayPhase: this.dayPhase, dayPaused: this.dayPaused, cache: this.cache, players, localPlayerId: this.localPlayerId, inventory: this.inventory, localName: this.localPlayer.name, localAppearance: this.localPlayer.appearance ?? DEFAULT_APPEARANCE, projectiles: this.projectiles, entities: this.entities, chests: this.chests, groundLoot: this.groundLoot, webs: this.webs, events, selfAdmin: this.selfAdmin, pingMs: this.pingMs };
  }

  private nextSeq(): number { return this.mode === "server" ? ++this.actionSeq : 0; }
  private armInvSeq(): number { const seq = this.nextSeq(); if (seq > 0) this.gates.inv = { pendingSeq: seq, atMs: performance.now() }; return seq; }
  private armChestSeq(): number { const seq = this.armInvSeq(); if (seq > 0) this.gates.chest = { pendingSeq: seq, atMs: performance.now() }; return seq; }
  private updateInventory(next: InventorySnapshot): void { this.inventory = next; this.localPlayer = { ...this.localPlayer, heldItem: heldItemForInventory(next) }; }
  private send(msg: ClientMessage): void { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg)); }
}
