import {
  LEVEL,
  PLAYER_MAX_STAMINA,
  WireMetrics,
  World,
  type BodyState,
  type ActiveStatusSnapshot,
  type ClientMessage,
  type InvStack,
  type MoveInput,
  type ServerSnapshot,
  type ServerWelcome,
  type LevelId,
} from "@dc2d/engine";
import { closeSocket, openSocket } from "./socket.js";
import type { ChatLine, ContactInfo, Toast, VisualEvent } from "./connectionTypes.js";
import { ConnectionActions } from "./ConnectionActions.js";
import {
  interpolateInto,
  type InterpolatedEntity,
  type RemoteEntity,
} from "./interpolate.js";
import { InterpolationDelay } from "./interpolationDelay.js";
import { sendMeasured } from "./measuredSend.js";
import { MovementCadence } from "./movementCadence.js";
import { sampleMovement, sendMovementEdge } from "./movementSampling.js";
import {
  MovementTraceRecorder,
  type MovementTraceClientState,
} from "./movementTrace.js";
import { Prediction } from "./prediction.js";
import { PredictionCorrection } from "./predictionCorrection.js";
import { SnapshotRevisionState } from "./snapshotState.js";
import { ServerTimeline } from "./serverTimeline.js";

/**
 * Client-visible game state and outgoing intents, protocol v2. Socket
 * wire mechanics live in socket.ts; snapshots apply server truth
 * (apply.ts); remote entities render interpolated (interpolate.ts).
 */

export type { ChatLine, ContactInfo, Toast, VisualEvent } from "./connectionTypes.js";

export class Connection extends ConnectionActions {
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
  stamina = PLAYER_MAX_STAMINA;
  maxStamina = PLAYER_MAX_STAMINA;
  blocking = false;
  staminaRecoveryDelaySeconds = 0;
  staminaExhausted = false;
  readonly contextualActionsUsed = new Set<"attack" | "block">();
  fx: string[] = [];
  /** Authoritative remaining/total status time, parallel to fx for HUD progress. */
  statusEffects: ActiveStatusSnapshot[] = [];
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
  mutedPlayers = new Set<string>();
  blockedPlayers = new Set<string>();
  visualEvents: VisualEvent[] = [];
  /** Set when the server teleported us (scene snaps the camera). */
  teleported = false;
  /** Set when hp climbs back from <=0 (net/apply.ts's respawn detection) — the scene
   * consumes this to start the client-local spawn-grace shield ring (selfCosmetics.ts's
   * startSelfGrace); see docs/ASSUMPTIONS.md row 380 for why this is an approximation,
   * not real server-driven grace state. */
  justRespawned = false;

  readonly entities = new Map<string, RemoteEntity>();
  private readonly interpolationFrame: InterpolatedEntity[] = [];
  readonly areaTiles = new Map<string, string>();
  /** Local movement prediction; apply.ts reconciles it per snapshot. */
  readonly prediction = new Prediction();
  /** Wire cadence is independent from the fixed prediction cadence. */
  readonly movementCadence = new MovementCadence();
  /** Render-only smoothing keeps authoritative correction out of simulation state. */
  readonly predictionCorrection = new PredictionCorrection();
  readonly serverTimeline = new ServerTimeline();
  readonly interpolationDelay = new InterpolationDelay();
  /** Live traffic/correction diagnostics expose the roadmap's reproducible baseline. */
  readonly networkMetrics = new WireMetrics();
  /** Opt-in 2D movement trace; the HUD owns starting, stopping, and downloading it. */
  readonly movementTrace = new MovementTraceRecorder();
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
  /** Terminal wire incompatibility: reconnecting cannot succeed until the page reloads. */
  updateRequired = false;
  updateRequiredMessage = "";

  constructor(readonly url: string, public name: string, readonly clientId: string) {
    super();
  }

  onConnected: (() => void) | null = null;
  onSnapshot: (() => void) | null = null;
  onUpdateRequired: ((message: string) => void) | null = null;
  get dead(): boolean {
    return this.status === "connected" && this.hasReceivedSnapshot && this.hp <= 0;
  }

  get canAct(): boolean {
    return this.status === "connected" && this.hasReceivedSnapshot && this.hp > 0 && !this.downed;
  }

  get canBlock(): boolean {
    return this.canAct && this.weapon !== null && this.stamina > 0 &&
      !this.staminaExhausted;
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
    this.stamina = PLAYER_MAX_STAMINA;
    this.blocking = false;
    this.staminaRecoveryDelaySeconds = 0;
    this.staminaExhausted = false;
    this.downed = false;
    this.justRespawned = false;
    this.hasReceivedSnapshot = false;
    this.snapshotRevisions.reset();
    this.entities.clear();
    this.interpolationFrame.length = 0;
    this.areaTiles.clear();
    this.prediction.reset();
    this.movementCadence.reset();
    this.predictionCorrection.reset();
    this.serverTimeline.reset();
    this.interpolationDelay.reset();
  }

  /** Called by the scene at the fixed tick rate. Predicts and sends. */
  sampleInput(input: MoveInput): void {
    if (input.block) this.contextualActionsUsed.add("block");
    sampleMovement(this, input);
  }

  sendInputEdge(input: MoveInput): void {
    sendMovementEdge(this, input);
  }

  // ── intents (bodies live in intents.ts, split out for the file-size cap) ──

  /** Throws a hotbar torch toward an aim direction (not a clicked tile) —
   * the dedicated Epic 7.8 torch-throw intent, distinct from useSlot's target-tile throw. */
  /** Descends a nearby one-way stairway; the server validates range. */
  /** Hold-F contact gesture intent — server gates range/rate/mutuality. */
  // ── dev harness (server drops these unless debugCommands is on) ──

  drainVisualEvents(): VisualEvent[] {
    const out = this.visualEvents;
    this.visualEvents = [];
    return out;
  }

  /** Peer positions rendered behind the server by the adaptive jitter buffer. */
  interpolated(
    now: number = performance.now(),
  ): readonly InterpolatedEntity[] {
    return interpolateInto(
      this.entities,
      this.interpolationDelay.currentMs,
      this.serverTimeline.now(now),
      this.interpolationFrame,
    );
  }

  send(msg: ClientMessage): void {
    if (msg.type === "input") {
      this.movementTrace.recordInput(msg, this.movementTraceState());
    }
    sendMeasured(this.ws, msg, this.networkMetrics);
  }

  movementTraceState(): MovementTraceClientState {
    return {
      status: this.status,
      serverTick: this.serverTick,
      rttMs: this.rttMs,
      projectedTick: this.prediction.projectedTick,
      pendingSteps: this.prediction.pendingStepCount,
      correctionError: this.predictionCorrection.lastError,
      body: this.body,
    };
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
