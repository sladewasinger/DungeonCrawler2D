import {
  TICK_DT,
  createPlayerResourceStep,
  stepBody,
  stepPlayerResourcesInto,
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
  seq: number;
  projectedServerTick: number;
  input: MoveInput;
}

function shouldRetainStep(
  step: PredictedStep,
  index: number,
  acknowledgedFutureIndex: number,
  lastAckedSeq: number,
  authoritativeServerTick: number,
): boolean {
  const belongsAfterSnapshot =
    step.projectedServerTick > authoritativeServerTick;
  const isUnacknowledged = step.seq > lastAckedSeq;
  return belongsAfterSnapshot &&
    (isUnacknowledged || index === acknowledgedFutureIndex);
}

export interface PredictedInputIdentity {
  readonly seq: number;
  readonly projectedServerTick: number;
}

export class Prediction {
  private seq = 0;
  private projectedServerTick: number | null = null;
  private readonly pending: PredictedStep[] = [];
  private readonly recycled: PredictedStep[] = [];
  private readonly resourceStep = createPlayerResourceStep();
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
  predict(
    world: World,
    body: BodyState,
    input: MoveInput,
    resources?: PlayerResourceState,
    canBlock = false,
  ): PredictedInputIdentity {
    this.seq++;
    this.projectedServerTick = (this.projectedServerTick ?? 0) + 1;
    const effective = this.effectiveInput(resources, input, canBlock);
    stepBody(world, body, effective, TICK_DT);
    this.pending.push(this.acquireStep(
      this.seq,
      this.projectedServerTick,
      input,
    ));
    if (this.pending.length > PREDICTION_HISTORY_LIMIT) {
      const evicted = this.pending.shift();
      if (evicted) this.recycleStep(evicted);
    }
    return { seq: this.seq, projectedServerTick: this.projectedServerTick };
  }

  /** Drop causally acknowledged inputs, rebase the projected clock, and replay the rest. */
  reconcile(
    world: World,
    body: BodyState,
    lastAckedSeq: number,
    authoritativeServerTick: number,
    resources?: PlayerResourceState,
    canBlock = false,
  ): void {
    const acknowledgedFutureIndex =
      this.findAcknowledgedFuture(lastAckedSeq, authoritativeServerTick);
    let retainedCount = 0;
    let nextProjectedServerTick = authoritativeServerTick;
    let index = 0;
    for (const step of this.pending) {
      const stepIndex = index++;
      if (!shouldRetainStep(
        step,
        stepIndex,
        acknowledgedFutureIndex,
        lastAckedSeq,
        authoritativeServerTick,
      )) {
        this.recycleStep(step);
        continue;
      }
      nextProjectedServerTick++;
      step.projectedServerTick = nextProjectedServerTick;
      this.pending[retainedCount] = step;
      retainedCount++;
    }
    this.pending.length = retainedCount;
    this.projectedServerTick = nextProjectedServerTick;
    for (const p of this.pending) {
      const effective = this.effectiveInput(resources, p.input, canBlock);
      stepBody(world, body, effective, TICK_DT);
    }
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

  private findAcknowledgedFuture(
    lastAckedSeq: number,
    authoritativeServerTick: number,
  ): number {
    let index = 0;
    for (const step of this.pending) {
      if (step.seq === lastAckedSeq &&
        step.projectedServerTick > authoritativeServerTick) {
        return index;
      }
      index++;
    }
    return -1;
  }

  private effectiveInput(
    resources: PlayerResourceState | undefined,
    input: MoveInput,
    canBlock: boolean,
  ): MoveInput {
    if (!resources) return input;
    return stepPlayerResourcesInto(
      resources,
      input,
      canBlock,
      TICK_DT,
      this.resourceStep,
    ).input;
  }

  private acquireStep(
    seq: number,
    projectedServerTick: number,
    input: MoveInput,
  ): PredictedStep {
    const step = this.recycled.pop();
    if (step) {
      step.seq = seq;
      step.projectedServerTick = projectedServerTick;
      step.input = input;
      return step;
    }
    this.allocatedStepRecords++;
    return { seq, projectedServerTick, input };
  }

  private recycleStep(step: PredictedStep): void {
    if (this.recycled.length < PREDICTION_HISTORY_LIMIT) this.recycled.push(step);
  }
}
