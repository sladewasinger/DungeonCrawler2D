/** Multiplayer WebSocket client with holistic action-ack gating and offline preview fallback. */
import {
  DAY_DURATION_SECONDS, DEFAULT_APPEARANCE, PROTOCOL_VERSION, ServerMessageSchema, WorldChunkCache, isInSanctuary, wrapDayPhase,
  type ArmorSlotKey, type CharacterAppearance, type ClientMessage, type GroundLootSnapshot, type InventorySnapshot,
  type PlayerSnapshot, type ProjectileSnapshot, type ServerMessage, type WorldChestSnapshot, type WorldEntitySnapshot, type WorldEvent,
} from "@dc2d/engine";
import { IDLE_GATE, resolvePendingGate, type PendingGate } from "./actionGate.js";
import { loadCharacterPrefs, sanitizeCharacterName, saveCharacterPrefs } from "./characterPrefs.js";
import {
  applyCraftRecipe, applyEquipArmor, applyMoveSlot, applySelectHotbar, applyUnequipArmor,
  createStarterInventorySnapshot, heldItemForInventory, isNearCampfire, reconcileInventorySnapshot,
} from "./clientInventory.js";
import { LocalSwingTracker } from "./localSwingTracker.js";
import { RemotePlayerSmoother } from "./remoteInterp.js";
import { createDefaultPlayer, defaultWsUrl, normalizeDirection, predictLocalPlayerMove, reconcilePredictedPlayer } from "./worldPrediction.js";

const INITIAL_DAY_PHASE = 0.62;
export type ConnectionMode = "connecting" | "server" | "local";

export interface StepInputFrame {
  readonly move: { readonly x: number; readonly y: number };
  readonly dt: number;
  readonly aim?: { readonly x: number; readonly y: number } | undefined;
  readonly jump?: boolean | undefined;
  readonly attack?: boolean | undefined;
  readonly bowDraw?: boolean | undefined;
  readonly bowRelease?: boolean | undefined;
  readonly block?: boolean | undefined;
  readonly dodge?: boolean | undefined;
  readonly interact?: boolean | undefined;
}

export interface WorldViewState {
  readonly mode: ConnectionMode;
  readonly dayPhase: number;
  readonly dayPaused: boolean;
  readonly cache: WorldChunkCache;
  readonly players: readonly PlayerSnapshot[];
  readonly localPlayerId: string;
  readonly inventory: InventorySnapshot;
  readonly localName: string;
  readonly localAppearance: CharacterAppearance;
  readonly projectiles: readonly ProjectileSnapshot[];
  readonly entities: readonly WorldEntitySnapshot[];
  readonly chests: readonly WorldChestSnapshot[];
  readonly groundLoot: readonly GroundLootSnapshot[];
  readonly events: readonly WorldEvent[];
}

const ACTION_FLAG_KEYS = ["jump", "attack", "bowDraw", "bowRelease", "block", "dodge", "interact"] as const;

function buildInputMessage(opts: {
  readonly seq: number; readonly moveDir: { readonly x: number; readonly y: number };
  readonly normAim: { readonly x: number; readonly y: number } | undefined; readonly input: StepInputFrame;
}): ClientMessage {
  const extras: Record<string, boolean> = {};
  for (const key of ACTION_FLAG_KEYS) {
    if (opts.input[key]) extras[key] = true;
  }
  return {
    t: "input", seq: opts.seq, moveX: opts.moveDir.x, moveY: opts.moveDir.y,
    ...(opts.normAim ? { aimX: opts.normAim.x, aimY: opts.normAim.y } : {}), ...extras,
  } as ClientMessage;
}

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
  private torchGate: PendingGate = IDLE_GATE;
  private dayGate: PendingGate = IDLE_GATE;
  private appearanceGate: PendingGate = IDLE_GATE;
  private localPlayer: PlayerSnapshot;
  private remotePlayers: PlayerSnapshot[] = [];
  private projectiles: readonly ProjectileSnapshot[] = [];
  private entities: readonly WorldEntitySnapshot[] = [];
  private chests: readonly WorldChestSnapshot[] = [];
  private groundLoot: readonly GroundLootSnapshot[] = [];
  private queuedEvents: WorldEvent[] = [];
  private readonly remoteSmoother = new RemotePlayerSmoother();
  private readonly swing = new LocalSwingTracker();
  private inventory: InventorySnapshot = createStarterInventorySnapshot();
  private readonly autoReconnect: boolean;
  private connectTimer: number | null = null;
  private reconnectTimer: number | null = null;

  constructor(wsUrl = defaultWsUrl(), opts?: { readonly autoConnect?: boolean }) {
    this.wsUrl = wsUrl;
    this.autoReconnect = opts?.autoConnect !== false;
    this.localPlayer = createDefaultPlayer("local", loadCharacterPrefs());
    if (this.autoReconnect) this.connect();
  }

  connect(): void {
    if (this.ws || this.mode === "connecting") return;
    if (this.reconnectTimer !== null) { window.clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.mode = "connecting";
    this.openSocket(this.wsUrl);
  }

  private openSocket(url: string): void {
    try {
      const ws = new WebSocket(url);
      this.ws = ws;
      this.connectTimer = window.setTimeout(() => { if (this.mode === "connecting") this.mode = "local"; }, 800);
      ws.addEventListener("open", () => this.sendHello());
      ws.addEventListener("message", (ev) => this.handleMessage(String(ev.data)));
      ws.addEventListener("close", () => this.switchToLocal());
      ws.addEventListener("error", () => this.switchToLocal());
    } catch { this.switchToLocal(); }
  }

  private sendHello(): void {
    const appearance = this.localPlayer.appearance ?? DEFAULT_APPEARANCE;
    this.send({ t: "hello", version: PROTOCOL_VERSION, name: this.localPlayer.name, appearance });
  }

  private switchToLocal(): void {
    if (this.connectTimer !== null) { window.clearTimeout(this.connectTimer); this.connectTimer = null; }
    this.mode = "local";
    this.ws = null;
    this.entities = [];
    this.projectiles = [];
    this.localPlayer = {
      ...this.localPlayer, dodging: false, blocking: false, staggerTimer: 0, bowCharge: 0, swingProgress: 0,
    };
    if (this.autoReconnect && this.reconnectTimer === null) {
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
    this.mode = "server";
    this.localPlayerId = msg.playerId;
    this.localPlayer = { ...this.localPlayer, id: msg.playerId };
    this.cache = new WorldChunkCache(msg.worldSeed);
    this.dayPhase = msg.dayPhase;
    this.dayPaused = msg.dayPaused;
  }

  private applyServerSnapshot(msg: Extract<ServerMessage, { t: "snapshot" }>): void {
    const nowMs = performance.now();
    const serverAck = msg.actionAckSeq ?? msg.selfInventory?.ackSeq ?? 0;
    const dayRes = resolvePendingGate(this.dayGate, { serverAck, nowMs });
    this.dayGate = dayRes.nextGate;
    if (dayRes.accept) { this.dayPhase = msg.dayPhase; this.dayPaused = msg.dayPaused; }
    if (msg.selfInventory) this.reconcileServerInventory(msg.selfInventory, serverAck, nowMs);
    this.reconcileServerPlayers({ players: msg.players, serverAck, nowMs });
    this.applyWorldStream(msg);
  }

  private applyWorldStream(msg: Extract<ServerMessage, { t: "snapshot" }>): void {
    this.projectiles = msg.projectiles ?? [];
    this.entities = msg.entities ?? [];
    this.chests = msg.chests ?? [];
    this.groundLoot = msg.groundLoot ?? [];
    if (!msg.events?.length) return;
    const filtered = this.filterServerEvents(msg.events);
    if (filtered.length > 0) this.queuedEvents = [...this.queuedEvents.slice(-48), ...filtered];
  }

  private filterServerEvents(events: readonly WorldEvent[]): readonly WorldEvent[] {
    if (!this.swing.hasPendingServerSwing()) return events;
    if (events.some((e) => e.kind === "swing" && e.actorId === this.localPlayerId)) this.swing.clearPendingServerSwing();
    return events.filter((e) => !(e.kind === "swing" && e.actorId === this.localPlayerId));
  }

  private reconcileServerPlayers(opts: { readonly players: readonly PlayerSnapshot[]; readonly serverAck: number; readonly nowMs: number }): void {
    this.remotePlayers = [...opts.players];
    this.remoteSmoother.setTargets(opts.players, this.localPlayerId);
    const torchRes = resolvePendingGate(this.torchGate, { serverAck: opts.serverAck, nowMs: opts.nowMs });
    const appRes = resolvePendingGate(this.appearanceGate, { serverAck: opts.serverAck, nowMs: opts.nowMs });
    this.torchGate = torchRes.nextGate;
    this.appearanceGate = appRes.nextGate;
    const me = opts.players.find((p) => p.id === this.localPlayerId);
    if (me) this.localPlayer = reconcilePredictedPlayer(this.localPlayer, me, { preserveTorch: !torchRes.accept, preserveAppearance: !appRes.accept });
  }

  private reconcileServerInventory(incoming: InventorySnapshot, serverAck: number, nowMs: number): void {
    const rec = reconcileInventorySnapshot({ current: this.inventory, incoming: { ...incoming, ackSeq: serverAck }, pendingSeq: this.invGate.pendingSeq, elapsedMs: nowMs - this.invGate.atMs });
    this.inventory = rec.inventory;
    if (rec.clearedPending) this.invGate = IDLE_GATE;
  }

  localPose(): { readonly x: number; readonly y: number; readonly elevation: number } { return this.localPlayer; }

  stepInput(input: StepInputFrame): void {
    const moveDir = normalizeDirection(input.move, true) ?? { x: 0, y: 0 };
    const normAim = normalizeDirection(input.aim, false);
    this.remoteSmoother.step(input.dt);
    this.swing.step({
      dt: input.dt, attack: Boolean(input.attack), heldId: heldItemForInventory(this.inventory),
      player: this.localPlayer, normAim, isServer: this.mode === "server", events: this.queuedEvents,
    });
    const swingProgress = this.swing.activeProgress(this.localPlayer.swingProgress);
    if (this.mode === "server") this.send(buildInputMessage({ seq: ++this.seq, moveDir, normAim, input }));
    this.localPlayer = predictLocalPlayerMove({ cache: this.cache, player: { ...this.localPlayer, swingProgress }, nx: moveDir.x, ny: moveDir.y, dt: input.dt, aim: normAim, jump: input.jump });
    if (this.mode === "server") return;
    if (!this.dayPaused) this.dayPhase = wrapDayPhase(this.dayPhase + input.dt / DAY_DURATION_SECONDS);
    this.localPlayer = { ...this.localPlayer, inSanctuary: isInSanctuary(this.localPlayer.x, this.localPlayer.y) };
    this.inventory = { ...this.inventory, nearCampfire: isNearCampfire(this.cache, this.localPlayer.x, this.localPlayer.y) };
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

  snapshot(): WorldViewState {
    const localWithGear: PlayerSnapshot = {
      ...this.localPlayer, heldItem: heldItemForInventory(this.inventory), armor: this.inventory.armor, ...this.swing.snapshotOverride(),
    };
    const players = this.mode === "server"
      ? this.remotePlayers.map((p) => (p.id === this.localPlayerId ? localWithGear : this.remoteSmoother.resolve(p)))
      : [localWithGear];
    const events = this.queuedEvents;
    this.queuedEvents = [];
    return {
      mode: this.mode, dayPhase: this.dayPhase, dayPaused: this.dayPaused, cache: this.cache, players, localPlayerId: this.localPlayerId,
      inventory: this.inventory, localName: this.localPlayer.name, localAppearance: this.localPlayer.appearance ?? DEFAULT_APPEARANCE,
      projectiles: this.projectiles, entities: this.entities, chests: this.chests, groundLoot: this.groundLoot, events,
    };
  }

  private nextSeq(): number { return this.mode === "server" ? ++this.actionSeq : 0; }
  private armInvSeq(): number { const seq = this.nextSeq(); if (seq > 0) this.invGate = { pendingSeq: seq, atMs: performance.now() }; return seq; }
  private updateInventory(next: InventorySnapshot): void { this.inventory = next; this.localPlayer = { ...this.localPlayer, heldItem: heldItemForInventory(next) }; }
  private send(msg: ClientMessage): void { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg)); }
}
