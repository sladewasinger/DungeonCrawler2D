import { TICK_DT, stepBody, type BodyState, type MoveInput, type World } from "@dc2d/engine";

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

  /** Advance the local body one tick and remember the input for replay. */
  predict(world: World, body: BodyState, input: MoveInput): PredictedInputIdentity {
    this.seq++;
    this.projectedServerTick = (this.projectedServerTick ?? 0) + 1;
    stepBody(world, body, input, TICK_DT);
    this.pending.push({
      serverTick: this.projectedServerTick,
      input,
    });
    if (this.pending.length > PREDICTION_HISTORY_LIMIT) this.pending.shift();
    return { seq: this.seq, projectedServerTick: this.projectedServerTick };
  }

  /** Drop prediction steps covered by acknowledged server progress, then replay newer work. */
  reconcile(world: World, body: BodyState, acknowledgedProjectedTick: number): void {
    this.projectedServerTick = Math.max(
      this.projectedServerTick ?? acknowledgedProjectedTick,
      acknowledgedProjectedTick,
    );
    this.pending = this.pending.filter((step) => step.serverTick > acknowledgedProjectedTick);
    for (const p of this.pending) stepBody(world, body, p.input, TICK_DT);
  }
}
