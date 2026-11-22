/** Multiplayer WebSocket client with holistic action-ack gating and offline preview fallback. */
import {
  DAY_DURATION_SECONDS, PROTOCOL_VERSION, ServerMessageSchema, WorldChunkCache, wrapDayPhase,
  type ArmorSlotKey, type ClientMessage, type InventorySnapshot, type PlayerSnapshot, type ServerMessage,
} from "@dc2d/engine";
import { IDLE_GATE, resolvePendingGate, type PendingGate } from "./actionGate.js";
import {
  applyCraftRecipe, applyEquipArmor, applyMoveSlot, applySelectHotbar, applyUnequipArmor,
  createStarterInventorySnapshot, heldItemForInventory, isNearCampfire, reconcileInventorySnapshot,
} from "./clientInventory.js";
import {
  createDefaultPlayer, defaultWsUrl, predictLocalPlayerMove, reconcilePredictedPlayer,
} from "./worldPrediction.js";

const INITIAL_DAY_PHASE = 0.62;
export type ConnectionMode = "connecting" | "server" | "local";

export interface WorldViewState {
  readonly mode: ConnectionMode;
  readonly dayPhase: number;
  readonly dayPaused: boolean;
  readonly cache: WorldChunkCache;
  readonly players: readonly PlayerSnapshot[];
  readonly localPlayerId: string;
  readonly inventory: InventorySnapshot;
}

export class WorldClient {
  private ws: WebSocket | null = null;
  private mode: ConnectionMode = "connecting";
  private cache = new WorldChunkCache(1337);
  private localPlayerId = "local";
  private dayPhase = INITIAL_DAY_PHASE;
  private dayPaused = false;
  private seq = 0;
  private actionSeq = 0;
  private invGate: PendingGate = IDLE_GATE;
  private torchGate: PendingGate = IDLE_GATE;
  private dayGate: PendingGate = IDLE_GATE;
  private localPlayer: PlayerSnapshot = createDefaultPlayer("local");
  private remotePlayers: PlayerSnapshot[] = [];
  private inventory: InventorySnapshot = createStarterInventorySnapshot();
  private connectTimer: number | null = null;

  constructor(wsUrl = defaultWsUrl()) { this.openSocket(wsUrl); }

  private openSocket(url: string): void {
    try {
      const ws = new WebSocket(url);
      this.ws = ws;
      this.connectTimer = window.setTimeout(() => { if (this.mode === "connecting") this.mode = "local"; }, 800);
      ws.addEventListener("open", () => this.send({ t: "hello", version: PROTOCOL_VERSION, name: "Adventurer" }));
      ws.addEventListener("message", (ev) => this.handleMessage(String(ev.data)));
      ws.addEventListener("close", () => this.switchToLocal());
      ws.addEventListener("error", () => this.switchToLocal());
    } catch { this.switchToLocal(); }
  }

  private switchToLocal(): void {
    if (this.connectTimer !== null) window.clearTimeout(this.connectTimer);
    this.mode = "local";
    this.ws = null;
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
    this.remotePlayers = msg.players;
    if (msg.selfInventory) this.reconcileServerInventory(msg.selfInventory, serverAck, nowMs);
    const torchRes = resolvePendingGate(this.torchGate, { serverAck, nowMs });
    this.torchGate = torchRes.nextGate;
    const me = msg.players.find((p) => p.id === this.localPlayerId);
    if (me) this.localPlayer = reconcilePredictedPlayer(this.localPlayer, me, { preserveTorch: !torchRes.accept });
  }

  private reconcileServerInventory(incoming: InventorySnapshot, serverAck: number, nowMs: number): void {
    const rec = reconcileInventorySnapshot({ current: this.inventory, incoming: { ...incoming, ackSeq: serverAck }, pendingSeq: this.invGate.pendingSeq, elapsedMs: nowMs - this.invGate.atMs });
    this.inventory = rec.inventory;
    if (rec.clearedPending) this.invGate = IDLE_GATE;
  }

  stepInput(move: { readonly x: number; readonly y: number }, dt: number): void {
    const mag = Math.hypot(move.x, move.y);
    const nx = mag > 0.05 ? move.x / Math.max(1, mag) : 0;
    const ny = mag > 0.05 ? move.y / Math.max(1, mag) : 0;
    if (this.mode === "server") this.send({ t: "input", seq: ++this.seq, moveX: nx, moveY: ny });
    this.localPlayer = predictLocalPlayerMove({ cache: this.cache, player: this.localPlayer, nx, ny, dt });
    if (this.mode === "server") return;
    if (!this.dayPaused) this.dayPhase = wrapDayPhase(this.dayPhase + dt / DAY_DURATION_SECONDS);
    this.inventory = { ...this.inventory, nearCampfire: isNearCampfire(this.cache, this.localPlayer.x, this.localPlayer.y) };
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
    const localWithHeld: PlayerSnapshot = { ...this.localPlayer, heldItem: heldItemForInventory(this.inventory) };
    const players = this.mode === "server" ? this.remotePlayers.map((p) => (p.id === this.localPlayerId ? localWithHeld : p)) : [localWithHeld];
    return { mode: this.mode, dayPhase: this.dayPhase, dayPaused: this.dayPaused, cache: this.cache, players, localPlayerId: this.localPlayerId, inventory: this.inventory };
  }

  private nextSeq(): number { return this.mode === "server" ? ++this.actionSeq : 0; }
  private armInvSeq(): number {
    const seq = this.nextSeq();
    if (seq > 0) this.invGate = { pendingSeq: seq, atMs: performance.now() };
    return seq;
  }
  private updateInventory(next: InventorySnapshot): void {
    this.inventory = next;
    this.localPlayer = { ...this.localPlayer, heldItem: heldItemForInventory(next) };
  }
  private send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }
}
