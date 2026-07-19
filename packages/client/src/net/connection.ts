import {
  LEVEL,
  World,
  encodeMessage,
  type BodyState,
  type ClientMessage,
  type EntitySnapshot,
  type InvStack,
  type MoveInput,
  type ServerSnapshot,
  type ServerWelcome,
  type LevelId,
} from "@dc2d/engine";
import { closeSocket, openSocket } from "./socket.js";
import { interpolated, type RemoteEntity } from "./interpolate.js";
import { Prediction } from "./prediction.js";

/**
 * Client-visible game state and outgoing intents, protocol v2. Socket
 * wire mechanics live in socket.ts; snapshots apply server truth
 * (apply.ts); remote entities render interpolated (interpolate.ts).
 */

export interface Toast {
  msg: string;
  until: number;
}

export interface ChatLine {
  channel: string;
  name: string;
  text: string;
}

/** Visual-only events the scene consumes each frame. */
export type VisualEvent =
  | { t: "hit"; id: string; amount: number }
  | { t: "death"; id: string }
  | { t: "status"; id: string; status: string; on: boolean };

export class Connection {
  world: World | null = null;
  welcome: ServerWelcome | null = null;
  body: BodyState | null = null;
  rttMs = 0;
  status: "connecting" | "connected" | "closed" = "closed";

  // Server-authoritative self state.
  hp = 0;
  maxHp = 1;
  fx: string[] = [];
  downed = false;
  /** Unlimited inventory: one stack per item def. */
  inventory: InvStack[] = [];
  /** Hotbar bindings (item defs); qty lives in inventory. */
  hotbar: Array<string | null> = [];
  /** Equipped weapon def; null = fists. */
  weapon: string | null = null;
  party: ServerSnapshot["party"] = null;

  // UI state fed by events.
  stash: Array<{ item: string; qty: number }> | null = null;
  pendingInvite: { from: string; name: string } | null = null;
  toasts: Toast[] = [];
  chatLog: ChatLine[] = [];
  visualEvents: VisualEvent[] = [];
  /** Set when the server teleported us (scene snaps the camera). */
  teleported = false;

  readonly entities = new Map<string, RemoteEntity>();
  readonly areaTiles = new Map<string, string>();
  /** Local movement prediction; apply.ts reconciles it per snapshot. */
  readonly prediction = new Prediction();

  // Wire/reconnect bookkeeping. Mutated only from socket.ts, which the
  // class delegates its lifecycle to; treat as this facade's internals.
  ws: WebSocket | null = null;
  pingTimer: ReturnType<typeof setInterval> | null = null;
  reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  shouldReconnect = false;
  level: LevelId = LEVEL.Dungeon;

  constructor(
    readonly url: string,
    public name: string,
    readonly clientId: string,
  ) {}

  onConnected: (() => void) | null = null;
  onSnapshot: (() => void) | null = null;

  get dead(): boolean {
    return this.status === "connected" && this.hp <= 0;
  }

  get canAct(): boolean {
    return this.status === "connected" && this.hp > 0 && !this.downed;
  }

  setName(name: string): void {
    this.name = name;
  }

  connect(level: LevelId = this.level): void {
    this.level = level;
    openSocket(this);
  }

  disconnect(): void {
    closeSocket(this);
    this.world = null;
    this.welcome = null;
    this.body = null;
    this.hp = 0;
    this.downed = false;
    this.entities.clear();
    this.areaTiles.clear();
    this.prediction.reset();
  }

  /** Called by the scene at the fixed tick rate. Predicts and sends. */
  sampleInput(input: MoveInput): void {
    if (!this.world || !this.body || !this.canAct) return;
    const seq = this.prediction.predict(this.world, this.body, input);
    this.send({
      type: "input",
      seq,
      moveX: input.moveX as -1 | 0 | 1,
      moveY: input.moveY as -1 | 0 | 1,
      jump: input.jump,
    });
  }

  // ── intents ──────────────────────────────────────────────────────

  attack(dirX: number, dirY: number): void {
    if (!this.canAct) return;
    // Normalize: the protocol carries a unit direction (aiming at a
    // point 5 tiles away must not fail validation and vanish).
    const len = Math.hypot(dirX, dirY) || 1;
    this.send({ type: "attack", dirX: dirX / len, dirY: dirY / len });
  }

  useSlot(slot: number, targetX?: number, targetY?: number): void {
    if (!this.canAct) return;
    this.send({
      type: "useSlot",
      slot,
      ...(targetX !== undefined && targetY !== undefined ? { targetX, targetY } : {}),
    });
  }

  pickup(): void {
    if (!this.canAct) return;
    this.send({ type: "pickup" });
  }

  drop(item: string): void {
    if (!this.canAct) return;
    this.send({ type: "drop", item });
  }

  assignSlot(slot: number, item: string | null): void {
    if (!this.canAct) return;
    this.send({ type: "assign", slot, item });
  }

  equip(item: string | null): void {
    if (!this.canAct) return;
    this.send({ type: "equip", item });
  }

  interact(): void {
    if (!this.canAct) return;
    this.send({ type: "interact" });
  }

  craft(recipe: string): void {
    if (!this.canAct) return;
    this.send({ type: "craft", recipe });
  }

  stashOp(op: "put" | "take", index: number): void {
    if (!this.canAct) return;
    this.send({ type: "stash", op, index });
  }

  partyOp(op: "invite" | "accept" | "leave", target?: string): void {
    if (!this.canAct) return;
    if (op === "accept") this.pendingInvite = null;
    this.send({ type: "party", op, ...(target !== undefined ? { target } : {}) });
  }

  chat(channel: "party" | "local", text: string): void {
    if (!this.canAct) return;
    this.send({ type: "chat", channel, text });
  }

  suicide(): void {
    if (this.status !== "connected" || this.hp <= 0) return;
    this.send({ type: "suicide" });
  }

  // ── dev harness (server drops these unless debugCommands is on) ──

  debugTeleport(x: number, y: number): void {
    this.send({ type: "debug", op: "teleport", x, y });
  }

  debugGod(on = true): void {
    this.send({ type: "debug", op: "god", on });
  }

  drainVisualEvents(): VisualEvent[] {
    const out = this.visualEvents;
    this.visualEvents = [];
    return out;
  }

  /** Peer positions rendered `delayMs` in the past, lerped. */
  interpolated(
    delayMs: number,
  ): Array<{ id: string; snap: EntitySnapshot; x: number; y: number; z: number }> {
    return interpolated(this.entities, delayMs);
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(encodeMessage(msg));
  }
}
