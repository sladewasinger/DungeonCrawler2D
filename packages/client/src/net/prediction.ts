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
  readonly seq: number;
  readonly input: MoveInput;
}

export interface PredictedInputIdentity {
  readonly seq: number;
  readonly projectedServerTick: number;
}

export class Prediction {
  private seq = 0;
  private projectedServerTick: number | null = null;
  private pending: PredictedStep[] = [];

  reset(): void {
    this.projectedServerTick = null;
    this.pending = [];
  }

  /** Reserve a wire identity for a control edge before the next fixed prediction tick. */
  nextInputIdentity(): PredictedInputIdentity {
    this.seq++;
    return {
      seq: this.seq,
      projectedServerTick: (this.projectedServerTick ?? 0) + 1,
    };
  }

  /** Advance the local body one tick and remember the input for replay. */
  predict(
    world: World,
    body: BodyState,
    input: MoveInput,
    resources?: PlayerResourceState,
    canBlock = false,
  ): PredictedInputIdentity {
    this.projectedServerTick = (this.projectedServerTick ?? 0) + 1;
    const effective = resources
      ? stepPlayerResources(resources, input, canBlock, TICK_DT).input
      : input;
    stepBody(world, body, effective, TICK_DT);
    this.seq++;
    this.pending.push({
      seq: this.seq,
      input,
    });
    if (this.pending.length > PREDICTION_HISTORY_LIMIT) this.pending.shift();
    return { seq: this.seq, projectedServerTick: this.projectedServerTick };
  }

  /** Drop server-acknowledged inputs, then replay only inputs the server has not consumed. */
  reconcile(
    world: World,
    body: BodyState,
    lastAckedSeq: number,
    resources?: PlayerResourceState,
    canBlock = false,
  ): void {
    this.pending = this.pending.filter((step) => step.seq > lastAckedSeq);
    for (const p of this.pending) {
      const effective = resources
        ? stepPlayerResources(resources, p.input, canBlock, TICK_DT).input
        : p.input;
      stepBody(world, body, effective, TICK_DT);
    }
  }
}
