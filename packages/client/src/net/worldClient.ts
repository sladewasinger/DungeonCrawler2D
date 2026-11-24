/** Multiplayer WebSocket client with holistic action-ack gating, chest ops, and offline preview fallback. */
import {
  AI_TUNING, DAY_DURATION_SECONDS, DEFAULT_APPEARANCE, PROTOCOL_VERSION, SANCTUARY_CENTER, STEALTH_TUNING,
  ServerMessageSchema, WorldChunkCache, wrapDayPhase,
  type ArmorSlotKey, type CharacterAppearance, type ClientMessage, type EntityKind, type GroundLootSnapshot,
  type InventorySnapshot, type PlayerSnapshot, type ProjectileSnapshot, type ServerMessage,
  type WorldChestSnapshot, type WorldEntitySnapshot, type WorldEvent, type WorldWebSnapshot,
} from "@dc2d/engine";
import { IDLE_GATE, resolvePendingGate, type PendingGate } from "./actionGate.js";
import { loadCharacterPrefs, sanitizeCharacterName, saveCharacterPrefs } from "./characterPrefs.js";
import {
  applyChestTakeAll, applyChestTransfer, applyCraftRecipe, applyEquipArmor, applyMoveSlot, applySelectHotbar,
  applyUnequipArmor, createStarterInventorySnapshot, findNearestChest, heldItemForInventory, isNearCampfire, reconcileInventorySnapshot,
} from "./clientInventory.js";
import { LocalSwingTracker } from "./localSwingTracker.js";
import { RemotePlayerSmoother } from "./remoteInterp.js";
import {
  applyLocalAtmosphere, bindPageDisconnect, buildInputMessage, mergeStreamEvents,
  prepareAdminDispatch, resetDisconnectedPlayer, type AdminSendRequest, type ConnectionMode, type StepInputFrame, type WorldViewState,
} from "./worldClientHelpers.js";
import { createDefaultPlayer, defaultWsUrl, normalizeDirection, predictLocalPlayerMove, reconcilePredictedPlayer } from "./worldPrediction.js";

export type { ConnectionMode, StepInputFrame, WorldViewState } from "./worldClientHelpers.js";

const INITIAL_DAY_PHASE = 0.62;

export class WorldClient {
  private readonly wsUrl: string;
  private ws: WebSocket | null = null;
  private mode: ConnectionMode = "local";
  private cache = new WorldChunkCache(1337);
  private localPlayerId = "local";
  private dayPhase = INITIAL_DAY_PHASE;
  private dayPaused = false;
  private seq = 0;
  private actionSeq = 0;
  private invGate: PendingGate = IDLE_GATE;
  private chestGate: PendingGate = IDLE_GATE;
  private torchGate: PendingGate = IDLE_GATE;
  private dayGate: PendingGate = IDLE_GATE;
  private appearanceGate: PendingGate = IDLE_GATE;
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
  private readonly autoReconnect: boolean;
  private manualDisconnect = false;
  private connectTimer: number | null = null;
  private reconnectTimer: number | null = null;

  constructor(wsUrl = defaultWsUrl(), opts?: { readonly autoConnect?: boolean }) {
    this.wsUrl = wsUrl;
    this.autoReconnect = opts?.autoConnect !== false;
    this.localPlayer = createDefaultPlayer("local", loadCharacterPrefs());
    bindPageDisconnect(() => this.disconnect());
    if (this.autoReconnect) this.connect();
  }

  connect(): void {
    if (this.ws || this.mode === "connecting") return;
    this.manualDisconnect = false;
    if (this.reconnectTimer !== null) { window.clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.mode = "connecting"; this.openSocket(this.wsUrl);
  }

  disconnect(): void {
    this.manualDisconnect = true;
    this.clearSocketTimers();
    const prev = this.ws;
    this.ws = null;
    if (prev) { try { prev.close(1000, "client disconnect"); } catch { /* closing */ } }
    this.localPlayerId = "local"; this.remotePlayers = [];
    this.remoteSmoother.setTargets([], "local");
    this.resetStreamState(true);
  }

  private openSocket(url: string): void {
    try {
      const ws = new WebSocket(url);
      this.ws = ws;
      this.connectTimer = window.setTimeout(() => { if (this.ws === ws && this.mode === "connecting") this.mode = "local"; }, 800);
      ws.addEventListener("open", () => { if (this.ws === ws) this.sendHello(); });
      ws.addEventListener("message", (ev) => { if (this.ws === ws) this.handleMessage(String(ev.data)); });
      ws.addEventListener("close", () => { if (this.ws === ws) this.switchToLocal(); });
      ws.addEventListener("error", () => { if (this.ws === ws) this.switchToLocal(); });
    } catch { this.switchToLocal(); }
  }

  private sendHello(): void {
    const appearance = this.localPlayer.appearance ?? DEFAULT_APPEARANCE;
    this.send({ t: "hello", version: PROTOCOL_VERSION, name: this.localPlayer.name, appearance });
  }

  private clearSocketTimers(): void {
    if (this.connectTimer !== null) { window.clearTimeout(this.connectTimer); this.connectTimer = null; }
    if (this.reconnectTimer !== null) { window.clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
  }

  private resetStreamState(resetId: boolean): void {
    this.mode = "local"; this.entities = []; this.projectiles = [];
    this.webs = undefined; this.localBowDrawing = false; this.selfAdmin = false;
    this.localPlayer = resetDisconnectedPlayer(this.localPlayer, resetId);
  }

  private switchToLocal(): void {
    this.clearSocketTimers();
    this.ws = null;
    this.resetStreamState(false);
    if (!this.manualDisconnect && this.autoReconnect && this.reconnectTimer === null) {
      this.reconnectTimer = window.setTimeout(() => { this.reconnectTimer = null; this.connect(); }, 2500);
    }
  }

  private handleMessage(raw: string): void {
    let json: unknown;
    try { json = JSON.parse(raw); } catch { return; }
    const parsed = ServerMessageSchema.safeParse(json);
    if (!parsed.success) return;
    if (parsed.data.t === "welcome") { this.applyWelcome(parsed.data); return; }
    this.applyServerSnapshot(parsed.data);
  }

  private applyWelcome(msg: Extract<ServerMessage, { t: "welcome" }>): void {
    if (this.connectTimer !== null) window.clearTimeout(this.connectTimer);
    this.mode = "server"; this.localPlayerId = msg.playerId;
    this.localPlayer = { ...this.localPlayer, id: msg.playerId };
    this.cache = new WorldChunkCache(msg.worldSeed); this.dayPhase = msg.dayPhase; this.dayPaused = msg.dayPaused;
  }

  private applyServerSnapshot(msg: Extract<ServerMessage, { t: "snapshot" }>): void {
    const nowMs = performance.now(); const serverAck = msg.actionAckSeq ?? msg.selfInventory?.ackSeq ?? 0;
    const dayRes = resolvePendingGate(this.dayGate, { serverAck, nowMs });
    this.dayGate = dayRes.nextGate;
    if (dayRes.accept) { this.dayPhase = msg.dayPhase; this.dayPaused = msg.dayPaused; }
    this.selfAdmin = Boolean(msg.selfAdmin);
    if (msg.selfInventory) this.reconcileServerInventory(msg.selfInventory, serverAck, nowMs);
    this.reconcileServerPlayers({ players: msg.players, serverAck, nowMs });
    this.applyWorldStream(msg, nowMs, serverAck);
  }

  private applyWorldStream(msg: Extract<ServerMessage, { t: "snapshot" }>, nowMs: number, serverAck: number): void {
    this.projectiles = msg.projectiles ?? []; this.entities = msg.entities ?? [];
    this.groundLoot = msg.groundLoot ?? []; this.webs = msg.webs;
    const chestRes = resolvePendingGate(this.chestGate, { serverAck, nowMs });
    this.chestGate = chestRes.nextGate;
    if (chestRes.accept && msg.chests) this.chests = msg.chests;
    if (msg.worldDeltas) this.cache.applyWorldDeltaSnapshot(msg.worldDeltas);
    this.queuedEvents = mergeStreamEvents({
      current: this.queuedEvents, incoming: msg.events,
      stripLocalSwing: this.swing.hasPendingServerSwing(), localId: this.localPlayerId, clearPending: () => this.swing.clearPendingServerSwing(),
    });
  }

  private reconcileServerPlayers(opts: { readonly players: readonly PlayerSnapshot[]; readonly serverAck: number; readonly nowMs: number }): void {
    this.remotePlayers = [...opts.players];
    this.remoteSmoother.setTargets(opts.players, this.localPlayerId);
    const torchRes = resolvePendingGate(this.torchGate, { serverAck: opts.serverAck, nowMs: opts.nowMs });
    const appRes = resolvePendingGate(this.appearanceGate, { serverAck: opts.serverAck, nowMs: opts.nowMs });
    this.torchGate = torchRes.nextGate;
    this.appearanceGate = appRes.nextGate;
    const me = opts.players.find((p) => p.id === this.localPlayerId);
    if (me) this.localPlayer = reconcilePredictedPlayer(this.localPlayer, me, { preserveTorch: !torchRes.accept, preserveAppearance: !appRes.accept, localBowDrawing: this.localBowDrawing });
  }

  private reconcileServerInventory(incoming: InventorySnapshot, serverAck: number, nowMs: number): void {
    const rec = reconcileInventorySnapshot({ current: this.inventory, incoming: { ...incoming, ackSeq: serverAck }, pendingSeq: this.invGate.pendingSeq, elapsedMs: nowMs - this.invGate.atMs });
    this.inventory = rec.inventory;
    if (rec.clearedPending) this.invGate = IDLE_GATE;
  }

  localPose(): { readonly x: number; readonly y: number; readonly elevation: number } { return this.localPlayer; }

  private stepLocalAtmosphere(dt: number): void {
    this.attackFlashTimer = Math.max(0, this.attackFlashTimer - dt);
    const attackFlash = Boolean(this.localPlayer.attackFlash) || this.attackFlashTimer > 0;
    const isServer = this.mode === "server";
    if (!isServer && !this.dayPaused) this.dayPhase = wrapDayPhase(this.dayPhase + dt / DAY_DURATION_SECONDS);
    this.localPlayer = applyLocalAtmosphere({ cache: this.cache, player: this.localPlayer, dayPhase: this.dayPhase, attackFlash, isServer });
    if (!isServer) this.inventory = { ...this.inventory, nearCampfire: isNearCampfire(this.cache, this.localPlayer.x, this.localPlayer.y) };
  }

  stepInput(input: StepInputFrame): void {
    const moveDir = normalizeDirection(input.move, true) ?? { x: 0, y: 0 };
    const normAim = normalizeDirection(input.aim, false);
    const heldId = heldItemForInventory(this.inventory);
    this.localBowDrawing = Boolean(input.bowDraw) && heldId === "bow";
    this.remoteSmoother.step(input.dt);
    const preEvCount = this.queuedEvents.length;
    this.swing.step({
      dt: input.dt, attack: Boolean(input.attack), attackHold: Boolean(input.attackHold), dodge: Boolean(input.dodge),
      heldId, player: this.localPlayer, normAim, isServer: this.mode === "server", events: this.queuedEvents,
    });
    if (this.queuedEvents.length > preEvCount || input.bowRelease) this.attackFlashTimer = STEALTH_TUNING.attackFlashSec;
    const swingProgress = this.swing.activeProgress(this.localPlayer.swingProgress);
    if (this.mode === "server") this.send(buildInputMessage({ seq: ++this.seq, moveDir, normAim, input }));
    this.localPlayer = predictLocalPlayerMove({ cache: this.cache, player: { ...this.localPlayer, heldItem: heldId, swingProgress }, nx: moveDir.x, ny: moveDir.y, dt: input.dt, aim: normAim, jump: input.jump, crouch: input.crouch, bowDraw: this.localBowDrawing });
    this.stepLocalAtmosphere(input.dt);
  }

  setCharacter(req: { readonly name: string; readonly appearance: CharacterAppearance }): void {
    const name = sanitizeCharacterName(req.name);
    this.localPlayer = { ...this.localPlayer, name, appearance: req.appearance };
    saveCharacterPrefs({ name, appearance: req.appearance });
    const seq = this.nextSeq();
    if (seq > 0) this.appearanceGate = { pendingSeq: seq, atMs: performance.now() };
    this.send({ t: "setAppearance", name, appearance: req.appearance, seq });
  }

  toggleTorch(): void { this.localPlayer = { ...this.localPlayer, torchLit: !this.localPlayer.torchLit }; const seq = this.nextSeq(); this.torchGate = { pendingSeq: seq, atMs: performance.now() }; this.send({ t: "toggleTorch", seq }); }
  respawn(): void {
    const seq = this.nextSeq();
    if (this.mode === "server") { this.send({ t: "respawn", seq }); return; }
    this.localPlayer = { ...this.localPlayer, x: SANCTUARY_CENTER.x, y: SANCTUARY_CENTER.y, elevation: 0, hp: this.localPlayer.maxHp ?? 100, stamina: this.localPlayer.maxStamina ?? 100 };
  }
  setDayPhase(dayPhase: number, paused?: boolean): void {
    this.dayPhase = wrapDayPhase(dayPhase);
    if (paused !== undefined) this.dayPaused = paused;
    const seq = this.nextSeq();
    this.dayGate = { pendingSeq: seq, atMs: performance.now() };
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

  snapshot(): WorldViewState {
    const localWithGear: PlayerSnapshot = { ...this.localPlayer, heldItem: heldItemForInventory(this.inventory), armor: this.inventory.armor, ...this.swing.snapshotOverride() };
    const players = this.mode === "server" ? this.remotePlayers.map((p) => (p.id === this.localPlayerId ? localWithGear : this.remoteSmoother.resolve(p))) : [localWithGear];
    const events = this.queuedEvents; this.queuedEvents = [];
    return { mode: this.mode, dayPhase: this.dayPhase, dayPaused: this.dayPaused, cache: this.cache, players, localPlayerId: this.localPlayerId, inventory: this.inventory, localName: this.localPlayer.name, localAppearance: this.localPlayer.appearance ?? DEFAULT_APPEARANCE, projectiles: this.projectiles, entities: this.entities, chests: this.chests, groundLoot: this.groundLoot, webs: this.webs, events, selfAdmin: this.selfAdmin };
  }

  private nextSeq(): number { return this.mode === "server" ? ++this.actionSeq : 0; }
  private armInvSeq(): number { const seq = this.nextSeq(); if (seq > 0) this.invGate = { pendingSeq: seq, atMs: performance.now() }; return seq; }
  private armChestSeq(): number { const seq = this.armInvSeq(); if (seq > 0) this.chestGate = { pendingSeq: seq, atMs: performance.now() }; return seq; }
  private updateInventory(next: InventorySnapshot): void { this.inventory = next; this.localPlayer = { ...this.localPlayer, heldItem: heldItemForInventory(next) }; }
  private send(msg: ClientMessage): void { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg)); }
}
