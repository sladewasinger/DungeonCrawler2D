import {
  MOVE_SPEED,
  type BodyState,
  type ContinuousMovementSpeedProjection,
  type MoveInput,
  type PlayerResourceState,
  type World,
} from "@dc2d/engine";
import { PredictionHistory } from "./predictionHistory.js";
import { PredictionMovementSpeed } from "./movement/predictionMovementSpeed.js";
import {
  replayPredictionStep,
  stepPredictedBody,
} from "./predictionStep.js";

export { PREDICTION_HISTORY_LIMIT } from "./predictionHistory.js";

/**
 * Client-side movement prediction: the local body advances through the
 * same engine stepBody the server runs, and steps newer than the
 * authoritative simulation tick replay on top of each snapshot.
 */
export interface PredictedInputIdentity {
  readonly seq: number;
  readonly projectedServerTick: number;
}

export interface PredictionRequest {
  world: World;
  body: BodyState;
  input: MoveInput;
  resources?: PlayerResourceState;
  canBlock?: boolean;
  movementSpeed?: number;
  movementSpeedProjection?: ContinuousMovementSpeedProjection;
}

export interface ReconciliationRequest {
  world: World;
  body: BodyState;
  lastSimulatedProjectedTick: number;
  authoritativeServerTick: number;
  resources?: PlayerResourceState;
  canBlock?: boolean;
  movementSpeed?: number;
  movementSpeedProjection?: ContinuousMovementSpeedProjection;
}

export class Prediction {
  private seq = 0;
  private projectedServerTick: number | null = null;
  private readonly history = new PredictionHistory();
  private readonly projectedMovementSpeed = new PredictionMovementSpeed();

  reset(): void {
    this.projectedServerTick = null;
    this.projectedMovementSpeed.reset();
    this.history.clear();
  }

  /** Reserve a wire identity for a changed control state, independent of simulation ticks. */
  nextInputIdentity(projectedServerTick = (this.projectedServerTick ?? 0) + 1): PredictedInputIdentity {
    this.seq++;
    return { seq: this.seq, projectedServerTick };
  }

  /** Advance one local tick and bind it to the sequence sent for this prediction. */
  predict(request: PredictionRequest): PredictedInputIdentity {
    const {
      world,
      body,
      input,
      resources,
      canBlock = false,
      movementSpeed = MOVE_SPEED,
      movementSpeedProjection,
    } = request;
    this.projectedMovementSpeed.ensure(movementSpeedProjection);
    this.seq++;
    this.projectedServerTick = (this.projectedServerTick ?? 0) + 1;
    stepPredictedBody({
      world,
      body,
      input,
      resources,
      canBlock,
      movementSpeed: this.projectedMovementSpeed.current(movementSpeed),
    });
    this.projectedMovementSpeed.advance();
    this.history.add(this.projectedServerTick, input);
    return { seq: this.seq, projectedServerTick: this.projectedServerTick };
  }

  /** Drop ticks the server actually simulated, then replay only the newer local steps. */
  reconcile(request: ReconciliationRequest): void {
    const {
      world,
      body,
      lastSimulatedProjectedTick,
      authoritativeServerTick,
      resources,
      canBlock = false,
      movementSpeed = MOVE_SPEED,
      movementSpeedProjection,
    } = request;
    this.projectedMovementSpeed.replace(movementSpeedProjection);
    const acknowledgedTick = this.resolveAcknowledgedTick(
      lastSimulatedProjectedTick,
      authoritativeServerTick,
    );
    this.history.discardThrough(acknowledgedTick);
    if (acknowledgedTick !== null) {
      this.projectedServerTick =
        this.history.steps[this.history.size - 1]?.projectedServerTick ?? acknowledgedTick;
    }
    for (const p of this.history.steps) replayPredictionStep(this.projectedMovementSpeed, {
      world,
      body,
      input: p.input,
      resources,
      canBlock,
      movementSpeed,
    });
  }

  private resolveAcknowledgedTick(
    lastSimulatedProjectedTick: number,
    authoritativeServerTick: number,
  ): number | null {
    if (lastSimulatedProjectedTick >= 0) return lastSimulatedProjectedTick;
    if (this.history.size === 0) return authoritativeServerTick;
    return null;
  }

  get pendingStepCount(): number {
    return this.history.size;
  }

  get allocatedStepRecordCount(): number {
    return this.history.allocatedCount;
  }

  get projectedTick(): number | null {
    return this.projectedServerTick;
  }

  currentMovementSpeed(fallback = MOVE_SPEED): number {
    return this.projectedMovementSpeed.current(fallback);
  }
}
