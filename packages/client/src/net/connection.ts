import {
  PROTOCOL_VERSION,
  World,
  createBody,
  decodeServerMessage,
  encodeMessage,
  type BodyState,
  type ClientMessage,
  type EntitySnapshot,
  type InvStack,
  type MoveInput,
  type ServerSnapshot,
  type ServerWelcome,
} from "@dc2d/engine";
import { applySnapshot } from "./apply";
import { loadResumeToken, saveResumeToken } from "./identity";
import { interpolated, type RemoteEntity } from "./interpolate";
import { Prediction } from "./prediction";

/**
 * WebSocket client, protocol v2: socket lifecycle, outgoing intents,
 * and the client-visible state. Prediction (prediction.ts) runs the
 * local body; snapshots apply server truth (apply.ts); remote entities
 * render interpolated (interpolate.ts).
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
  status: "connecting" | "connected" | "closed" = "connecting";

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

  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly url: string,
    private readonly name: string,
    private readonly clientId: string,
  ) {}

  connect(): void {
    this.status = "connecting";
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => {
      const resumeToken = loadResumeToken();
      this.sendRaw({
        type: "hello",
        protocol: PROTOCOL_VERSION,
        name: this.name,
        clientId: this.clientId,
        ...(resumeToken ? { resumeToken } : {}),
      });
    };

    ws.onmessage = (event) => {
      const msg = decodeServerMessage(String(event.data));
      if (msg) this.handle(msg);
    };

    ws.onclose = () => {
      this.status = "closed";
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = null;
      setTimeout(() => this.connect(), 1000);
    };
  }

  private handle(msg: NonNullable<ReturnType<typeof decodeServerMessage>>): void {
    switch (msg.type) {
      case "welcome":
        this.onWelcome(msg);
        return;
      case "snapshot":
        applySnapshot(this, msg);
        return;
      case "pong":
        this.rttMs = performance.now() - msg.t;
        return;
      case "error":
        console.error(`[server] ${msg.code}: ${msg.message}`);
        return;
    }
  }

  private onWelcome(msg: ServerWelcome): void {
    this.welcome = msg;
    this.status = "connected";
    saveResumeToken(msg.resumeToken);
    this.world = new World(msg.worldSeed, msg.floor);
    this.body = createBody(msg.spawn.x, msg.spawn.y, msg.spawn.z);
    this.prediction.reset();
    this.entities.clear();
    this.areaTiles.clear();
    this.teleported = true;
    if (!this.pingTimer) {
      this.pingTimer = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.sendRaw({ type: "ping", t: performance.now() });
        }
      }, 2000);
    }
  }

  /** Called by the scene at the fixed tick rate. Predicts and sends. */
  sampleInput(input: MoveInput): void {
    if (!this.world || !this.body || this.status !== "connected") return;
    const seq = this.prediction.predict(this.world, this.body, input);
    this.sendRaw({
      type: "input",
      seq,
      moveX: input.moveX as -1 | 0 | 1,
      moveY: input.moveY as -1 | 0 | 1,
      jump: input.jump,
    });
  }

  // ── intents ──────────────────────────────────────────────────────

  attack(dirX: number, dirY: number): void {
    // Normalize: the protocol carries a unit direction (aiming at a
    // point 5 tiles away must not fail validation and vanish).
    const len = Math.hypot(dirX, dirY) || 1;
    this.sendRaw({ type: "attack", dirX: dirX / len, dirY: dirY / len });
  }

  useSlot(slot: number, targetX?: number, targetY?: number): void {
    this.sendRaw({
      type: "useSlot",
      slot,
      ...(targetX !== undefined && targetY !== undefined ? { targetX, targetY } : {}),
    });
  }

  pickup(): void {
    this.sendRaw({ type: "pickup" });
  }

  drop(item: string): void {
    this.sendRaw({ type: "drop", item });
  }

  assignSlot(slot: number, item: string | null): void {
    this.sendRaw({ type: "assign", slot, item });
  }

  equip(item: string | null): void {
    this.sendRaw({ type: "equip", item });
  }

  interact(): void {
    this.sendRaw({ type: "interact" });
  }

  craft(recipe: string): void {
    this.sendRaw({ type: "craft", recipe });
  }

  stashOp(op: "put" | "take", index: number): void {
    this.sendRaw({ type: "stash", op, index });
  }

  partyOp(op: "invite" | "accept" | "leave", target?: string): void {
    if (op === "accept") this.pendingInvite = null;
    this.sendRaw({ type: "party", op, ...(target !== undefined ? { target } : {}) });
  }

  chat(channel: "party" | "local", text: string): void {
    this.sendRaw({ type: "chat", channel, text });
  }

  // ── dev harness (server drops these unless debugCommands is on) ──

  debugTeleport(x: number, y: number): void {
    this.sendRaw({ type: "debug", op: "teleport", x, y });
  }

  debugGod(on = true): void {
    this.sendRaw({ type: "debug", op: "god", on });
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

  private sendRaw(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(encodeMessage(msg));
  }
}
