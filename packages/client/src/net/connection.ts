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
import type { ChatLine, ContactInfo, Toast, VisualEvent } from "./connectionTypes.js";
import { interpolated, type RemoteEntity } from "./interpolate.js";
import {
  assignSlotIntent,
  attackIntent,
  chatIntent,
  craftIntent,
  debugGodIntent,
  debugTeleportIntent,
  descendIntent,
  dropIntent,
  equipIntent,
  fistbumpIntent,
  interactIntent,
  partyOpIntent,
  pickupIntent,
  stashOpIntent,
  suicideIntent,
  throwTorchIntent,
  useItemIntent,
  useSlotIntent,
  whoIntent,
} from "./intents.js";
import { Prediction } from "./prediction.js";
import { PredictionCorrection } from "./predictionCorrection.js";
import { SnapshotRevisionState } from "./snapshotState.js";

/**
 * Client-visible game state and outgoing intents, protocol v2. Socket
 * wire mechanics live in socket.ts; snapshots apply server truth
 * (apply.ts); remote entities render interpolated (interpolate.ts).
 */

export type { ChatLine, ContactInfo, Toast, VisualEvent } from "./connectionTypes.js";

export class Connection {
  world: World | null = null;
  welcome: ServerWelcome | null = null;
  body: BodyState | null = null;
  rttMs = 0;
  status: "connecting" | "connected" | "closed" = "closed";
  /** The last applied snapshot's server tick — placed-torch ember-fade math
   * (scenes/dungeon/torchSync.ts) counts down against this. */
  serverTick = 0;
  readonly snapshotRevisions = new SnapshotRevisionState();
  /** Set true the first time applySnapshot ever runs — gates `dead` below so the
   * default `hp = 0` never reads as a real death before server truth has arrived
   * (docs/ASSUMPTIONS.md #88's client-side gap: welcome sets status "connected"
   * before hp is known). */
  hasReceivedSnapshot = false;

  // Server-authoritative self state.
  hp = 0;
  maxHp = 1;
  fx: string[] = [];
  downed = false;
  /** Epic 11 core (character levels) — current XP, character level, and XP still
   * needed for the next level; live on the wire since protocol 14 (ASSUMPTION #90).
   * Named `charLevel` — `level` is already taken by the game LEVEL (dungeon/sandbox). */
  xp = 0;
  charLevel = 1;
  xpForNext = 0;
  /** Epic 7.14 (The Descent) — current floor (net/apply.ts's applyFloorState reads
   * snap.self.floor, welcome.floor before the first snapshot); net/floorEvents.ts
   * diffs this for the floor banner. */
  floor = 1;
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
  /** Set when hp climbs back from <=0 (net/apply.ts's respawn detection) — the scene
   * consumes this to start the client-local spawn-grace shield ring (selfCosmetics.ts's
   * startSelfGrace); see docs/ASSUMPTIONS.md row 380 for why this is an approximation,
   * not real server-driven grace state. */
  justRespawned = false;

  readonly entities = new Map<string, RemoteEntity>();
  readonly areaTiles = new Map<string, string>();
  /** Local movement prediction; apply.ts reconciles it per snapshot. */
  readonly prediction = new Prediction();
  /** Render-only displacement needed to keep interpolation on the reconciled timeline. */
  readonly predictionCorrection = new PredictionCorrection();

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
    return this.status === "connected" && this.hasReceivedSnapshot && this.hp <= 0;
  }

  get canAct(): boolean {
    return this.status === "connected" && this.hp > 0 && !this.downed;
  }

  setName(name: string): void { this.name = name; }

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
    this.justRespawned = false;
    this.hasReceivedSnapshot = false;
    this.snapshotRevisions.reset();
    this.entities.clear();
    this.areaTiles.clear();
    this.prediction.reset();
    this.predictionCorrection.reset();
  }

  /** Called by the scene at the fixed tick rate. Predicts and sends. */
  sampleInput(input: MoveInput): void {
    if (!this.world || !this.body || !this.canAct) return;
    const seq = this.prediction.predict(this.world, this.body, input);
    this.send({
      type: "input",
      seq,
      moveX: input.moveX,
      moveY: input.moveY,
      ...(input.faceX !== undefined ? { faceX: input.faceX } : {}),
      ...(input.faceY !== undefined ? { faceY: input.faceY } : {}),
      jump: input.jump,
      run: input.run ?? false,
    });
  }

  // ── intents (bodies live in intents.ts, split out for the file-size cap) ──

  attack(dirX: number, dirY: number): void {
    attackIntent(this, dirX, dirY);
  }

  /** Throws a hotbar torch toward an aim direction (not a clicked tile) —
   * the dedicated Epic 7.8 torch-throw intent, distinct from useSlot's target-tile throw. */
  throwTorch(dirX: number, dirY: number): void {
    throwTorchIntent(this, dirX, dirY);
  }

  useSlot(slot: number, targetX?: number, targetY?: number): void { useSlotIntent(this, slot, targetX, targetY); }

  useItem(item: string): void { useItemIntent(this, item); }

  pickup(): void { pickupIntent(this); }

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

  /** Descends/ascends a nearby stairway (Epic 7.14) — server validates range. */
  descend(): void {
    descendIntent(this);
  }

  craft(recipe: string): void {
    craftIntent(this, recipe);
  }

  stashOp(op: "put" | "take", index: number): void {
    stashOpIntent(this, op, index);
  }

  partyOp(op: "invite" | "accept" | "decline" | "leave", target?: string): void {
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

  /**
   * Queues a client-local toast through the same queue/renderer as server "toast"
   * events (net/apply.ts, ui/widgets/hud/toastStack.ts) — for failures the client can
   * already tell won't do anything (no crafting table nearby, out of torches...)
   * without waiting on a server round trip. Never asserts a gameplay outcome, purely
   * UI feedback; the real intent is still sent to the server regardless.
   */
  pushToast(msg: string, ms = 2500): void {
    this.toasts.push({ msg, until: performance.now() + ms });
    if (this.toasts.length > 5) this.toasts.shift();
  }
}
