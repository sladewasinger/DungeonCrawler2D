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
import {
  assignSlotIntent,
  attackIntent,
  chatIntent,
  craftIntent,
  debugGodIntent,
  debugTeleportIntent,
  dropIntent,
  equipIntent,
  fistbumpIntent,
  interactIntent,
  partyOpIntent,
  pickupIntent,
  stashOpIntent,
  suicideIntent,
  throwTorchIntent,
  useSlotIntent,
  whoIntent,
} from "./intents.js";
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
  from: string;
  name: string;
  text: string;
  /** DM thread partner's display name (set on "dm" lines only). */
  target?: string;
}

export interface ContactInfo {
  name: string;
  online: boolean;
}

/** Visual-only events the scene consumes each frame. */
export type VisualEvent =
  | { t: "hit"; id: string; amount: number }
  | { t: "death"; id: string }
  | { t: "status"; id: string; status: string; on: boolean }
  /** Client-detected (net/apply.ts's fistbumpSeal parse) — server sends no dedicated
   * wire event for a sealed contact, only the system chat line this is derived from. */
  | { t: "fistbumpSealed"; partnerName: string };

export class Connection {
  world: World | null = null;
  welcome: ServerWelcome | null = null;
  body: BodyState | null = null;
  rttMs = 0;
  status: "connecting" | "connected" | "closed" = "closed";
  /** The last applied snapshot's server tick — placed-torch ember-fade math
   * (scenes/dungeon/torchSync.ts) counts down against this. */
  serverTick = 0;

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
  /** Monotonic count of chat lines ever received — chatLog trims from the front,
   * so consumers (ui/chat/controller.ts) diff against this to find new lines. */
  chatSeq = 0;
  /** Mutual contacts, refreshed wholesale on every server contactsUpdated event. */
  contacts: ContactInfo[] = [];
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
  /** Consecutive failed reconnect attempts since the last successful welcome — the
   * reconnect toast's attempt count (Epic 7.12); reset to 0 on every onWelcome. */
  reconnectAttempts = 0;
  /** Set once retries give up past RECONNECT_GRACE_MS worth of attempts — the scene
   * routes to title instead of leaving a dead "Reconnecting..." spinner forever. */
  sessionExpired = false;

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
      run: input.run ?? false,
    });
  }

  // ── intents (bodies live in intents.ts, split out for the file-size cap) ──

  attack(dirX: number, dirY: number): void {
    attackIntent(this, dirX, dirY);
  }

  /** Throws the equipped throwable toward an aim direction (not a clicked tile) —
   * the dedicated Epic 7.8 torch-throw intent, distinct from useSlot's target-tile throw. */
  throwTorch(dirX: number, dirY: number): void {
    throwTorchIntent(this, dirX, dirY);
  }

  useSlot(slot: number, targetX?: number, targetY?: number): void {
    useSlotIntent(this, slot, targetX, targetY);
  }

  pickup(): void {
    pickupIntent(this);
  }

  drop(item: string): void {
    dropIntent(this, item);
  }

  assignSlot(slot: number, item: string | null): void {
    assignSlotIntent(this, slot, item);
  }

  equip(item: string | null): void {
    equipIntent(this, item);
  }

  interact(): void {
    interactIntent(this);
  }

  craft(recipe: string): void {
    craftIntent(this, recipe);
  }

  stashOp(op: "put" | "take", index: number): void {
    stashOpIntent(this, op, index);
  }

  partyOp(op: "invite" | "accept" | "leave", target?: string): void {
    partyOpIntent(this, op, target);
  }

  chat(channel: "party" | "local" | "global" | "dm", text: string, target?: string): void {
    chatIntent(this, channel, text, target);
  }

  /** Hold-F contact gesture intent — server gates range/rate/mutuality. */
  fistbump(targetId: string): void {
    fistbumpIntent(this, targetId);
  }

  who(): void {
    whoIntent(this);
  }

  suicide(): void {
    suicideIntent(this);
  }

  // ── dev harness (server drops these unless debugCommands is on) ──

  debugTeleport(x: number, y: number): void {
    debugTeleportIntent(this, x, y);
  }

  debugGod(on = true): void {
    debugGodIntent(this, on);
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
