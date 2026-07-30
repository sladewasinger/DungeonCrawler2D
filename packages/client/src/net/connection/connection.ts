import {
  type ClientMessage,
  type MoveInput,
  type LevelId,
  type PlayerSkin,
  TICK_RATE,
} from "@dc2d/engine";
import {
  closeSocket,
  openSocket,
} from "./socket.js";
import type { DeathVisualEvent, VisualEvent } from "./connectionTypes.js";
import { ConnectionActions } from "./ConnectionActions.js";
import {
  interpolateInto,
  type InterpolationEntityFilter,
  type InterpolatedEntity,
} from "../interpolation/interpolate.js";
import { sendMeasured } from "../transport/measuredSend.js";
import { sampleMovement, sendMovementEdge } from "../movement/movementSampling.js";
import type {
  MovementTraceClientState,
} from "../movement/movementTrace.js";
import { resetDisconnectedConnection } from "./connectionReset.js";
import {
  saveExperimentalCorpNetSettings,
  setExperimentalCorpNetMode,
} from "../corpnet/index.js";

/**
 * Client-visible game state and outgoing intents, protocol v2. Socket
 * wire mechanics live in socket.ts; snapshots apply server truth
 * (apply.ts); remote entities render interpolated (interpolate.ts).
 */

export type { ChatLine, ContactInfo, DeathVisualEvent, NpcSpeech, Toast, VisualEvent } from "./connectionTypes.js";

export class Connection extends ConnectionActions {
  private readonly interpolationFrame: InterpolatedEntity[] = [];

  onConnected: (() => void) | null = null;
  onSnapshot: (() => void) | null = null;
  onUpdateRequired: ((message: string) => void) | null = null;

  constructor(url: string, name: string, clientId: string) {
    super(url, name, clientId);
    this.interpolationDelay.setExperimentalCorpNetEnabled(this.corpNet.enabled);
  }

  get experimentalCorpNetEnabled(): boolean {
    return this.corpNet.enabled;
  }

  get shouldHoldMovementPrediction(): boolean {
    return this.corpNet.shouldHoldPrediction(performance.now());
  }

  setExperimentalCorpNetEnabled(enabled: boolean): void {
    const changed = this.corpNet.enabled !== enabled;
    saveExperimentalCorpNetSettings({ schemaVersion: 1, enabled });
    setExperimentalCorpNetMode(this, enabled);
    if (changed && this.status === "connected") {
      this.send({ type: "networkProfile", profile: enabled ? "corpnet" : null });
    }
  }

  get dead(): boolean {
    return this.status === "connected" && this.hasReceivedSnapshot && this.hp <= 0 && !this.downed && this.respawnAtTick !== null;
  }

  get canAct(): boolean {
    return this.status === "connected" && this.hasReceivedSnapshot && this.hp > 0 && !this.downed;
  }

  get canBlock(): boolean {
    return this.canAct && this.weapon !== null && this.stamina > 0 &&
      !this.staminaExhausted;
  }

  setName(name: string): void { this.name = name; }
  setSkin(skin: PlayerSkin): void { this.skin = skin; }
  connect(level: LevelId = this.level): void {
    this.level = level;
    openSocket(this);
  }

  disconnect(): void {
    closeSocket(this);
    resetDisconnectedConnection(this);
  }

  clearInterpolationFrame(): void { this.interpolationFrame.length = 0; }

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

  get respawnSecondsRemaining(): number { return this.respawnAtTick === null ? 0 : Math.ceil(Math.max(0, this.respawnAtTick - this.serverTick) / TICK_RATE); } get downedSecondsRemaining(): number { return this.downedUntilTick === null ? 0 : Math.ceil(Math.max(0, this.downedUntilTick - this.serverTick) / TICK_RATE); }

  drainDeathVisualEvents(): DeathVisualEvent[] {
    const out = this.deathVisualEvents;
    this.deathVisualEvents = [];
    return out;
  }

  /** Peer positions rendered behind the server by the adaptive jitter buffer. */
  interpolated(
    now: number = performance.now(),
    include?: InterpolationEntityFilter,
  ): readonly InterpolatedEntity[] {
    return interpolateInto({
      entities: this.entities,
      delayMs: this.interpolationDelay.currentMs,
      now: this.serverTimeline.now(now),
      out: this.interpolationFrame,
      ...(include ? { include } : {}),
    });
  }

  send(msg: ClientMessage): void {
    if (import.meta.env.DEV && msg.type === "input") {
      this.movementTrace?.recordInput(msg, this.movementTraceState());
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
