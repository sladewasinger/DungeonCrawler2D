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
  readonly serverTick: number;
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

  /** Reserve a wire identity for a changed control state, independent of simulation ticks. */
  nextInputIdentity(projectedServerTick = (this.projectedServerTick ?? 0) + 1): PredictedInputIdentity {
    this.seq++;
    return { seq: this.seq, projectedServerTick };
  }

  /** Advance the local body one tick and remember the input for replay. */
  predict(
    world: World,
    body: BodyState,
    input: MoveInput,
    resources?: PlayerResourceState,
    canBlock = false,
  ): number {
    this.projectedServerTick = (this.projectedServerTick ?? 0) + 1;
    const effective = resources
      ? stepPlayerResources(resources, input, canBlock, TICK_DT).input
      : input;
    stepBody(world, body, effective, TICK_DT);
    this.pending.push({
      serverTick: this.projectedServerTick,
      input,
    });
    if (this.pending.length > PREDICTION_HISTORY_LIMIT) this.pending.shift();
    return this.projectedServerTick;
  }

  /** Drop simulation steps covered by server time, then replay genuinely newer work. */
  reconcile(
    world: World,
    body: BodyState,
    authoritativeServerTick: number,
    resources?: PlayerResourceState,
    canBlock = false,
  ): void {
    this.projectedServerTick = Math.max(
      this.projectedServerTick ?? authoritativeServerTick,
      authoritativeServerTick,
    );
    this.pending = this.pending.filter((step) => step.serverTick > authoritativeServerTick);
    for (const p of this.pending) {
      const effective = resources
        ? stepPlayerResources(resources, p.input, canBlock, TICK_DT).input
        : p.input;
      stepBody(world, body, effective, TICK_DT);
    }
  }
}
