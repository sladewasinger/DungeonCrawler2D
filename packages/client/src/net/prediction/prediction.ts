import {
  TICK_DT,
  stepBody,
  stepPlayerResources,
  type BodyState,
  type MoveInput,
  type PlayerResourceState,
  type World,
} from "@dc2d/engine";

/**
 * Client-side movement prediction: the local body advances through the
 * same engine stepBody the server runs, and steps newer than the
 * authoritative simulation tick replay on top of each snapshot.
 */
export const PREDICTION_HISTORY_LIMIT = 64;

interface PredictedStep {
  projectedServerTick: number;
  input: MoveInput;
}

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
}

export interface ReconciliationRequest {
  world: World;
  body: BodyState;
  lastSimulatedProjectedTick: number;
  authoritativeServerTick: number;
  resources?: PlayerResourceState;
  canBlock?: boolean;
}

export class Prediction {
  private seq = 0;
  private projectedServerTick: number | null = null;
  private readonly pending: PredictedStep[] = [];
  private readonly recycled: PredictedStep[] = [];
  private allocatedStepRecords = 0;

  reset(): void {
    this.projectedServerTick = null;
    for (const step of this.pending) this.recycleStep(step);
    this.pending.length = 0;
  }

  /** Reserve a wire identity for a changed control state, independent of simulation ticks. */
  nextInputIdentity(projectedServerTick = (this.projectedServerTick ?? 0) + 1): PredictedInputIdentity {
    this.seq++;
    return { seq: this.seq, projectedServerTick };
  }

  /** Advance one local tick and bind it to the sequence sent for this prediction. */
  predict(request: PredictionRequest): PredictedInputIdentity {
    const { world, body, input, resources, canBlock = false } = request;
    this.seq++;
    this.projectedServerTick = (this.projectedServerTick ?? 0) + 1;
    const effective = resources
      ? stepPlayerResources({ state: resources, input, canBlock, dt: TICK_DT }).input
      : input;
    stepBody(world, body, effective, TICK_DT);
    this.pending.push(this.acquireStep(this.projectedServerTick, input));
    if (this.pending.length > PREDICTION_HISTORY_LIMIT) {
      const evicted = this.pending.shift();
      if (evicted) this.recycleStep(evicted);
    }
    return { seq: this.seq, projectedServerTick: this.projectedServerTick };
  }

  /** Drop ticks the server actually simulated, then replay only the newer local steps. */
  reconcile(request: ReconciliationRequest): void {
    const { world, body, lastSimulatedProjectedTick, authoritativeServerTick, resources, canBlock = false } = request;
    const acknowledgedTick = this.resolveAcknowledgedTick(
      lastSimulatedProjectedTick,
      authoritativeServerTick,
    );
    this.discardSimulatedSteps(acknowledgedTick);
    if (acknowledgedTick !== null) {
      this.projectedServerTick =
        this.pending[this.pending.length - 1]?.projectedServerTick ?? acknowledgedTick;
    }
    for (const p of this.pending) {
      const effective = resources
        ? stepPlayerResources({ state: resources, input: p.input, canBlock, dt: TICK_DT }).input
        : p.input;
      stepBody(world, body, effective, TICK_DT);
    }
  }

  private resolveAcknowledgedTick(
    lastSimulatedProjectedTick: number,
    authoritativeServerTick: number,
  ): number | null {
    if (lastSimulatedProjectedTick >= 0) return lastSimulatedProjectedTick;
    if (this.pending.length === 0) return authoritativeServerTick;
    return null;
  }

  private discardSimulatedSteps(acknowledgedTick: number | null): void {
    let retainedCount = 0;
    for (const step of this.pending) {
      if (acknowledgedTick !== null && step.projectedServerTick <= acknowledgedTick) {
        this.recycleStep(step);
        continue;
      }
      this.pending[retainedCount] = step;
      retainedCount++;
    }
    this.pending.length = retainedCount;
  }

  get pendingStepCount(): number {
    return this.pending.length;
  }

  get allocatedStepRecordCount(): number {
    return this.allocatedStepRecords;
  }

  get projectedTick(): number | null {
    return this.projectedServerTick;
  }

  private acquireStep(
    projectedServerTick: number,
    input: MoveInput,
  ): PredictedStep {
    const step = this.recycled.pop();
    if (step) {
      step.projectedServerTick = projectedServerTick;
      step.input = input;
      return step;
    }
    this.allocatedStepRecords++;
    return { projectedServerTick, input };
  }

  private recycleStep(step: PredictedStep): void {
    if (this.recycled.length < PREDICTION_HISTORY_LIMIT) this.recycled.push(step);
  }
}
