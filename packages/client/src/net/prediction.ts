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

export class Prediction {
  private seq = 0;
  private projectedServerTick: number | null = null;
  private pending: PredictedStep[] = [];

  reset(): void {
    this.projectedServerTick = null;
    this.pending = [];
  }

  /** Advance the local body one tick and remember the input for replay. */
  predict(world: World, body: BodyState, input: MoveInput): number {
    this.seq++;
    this.projectedServerTick = (this.projectedServerTick ?? 0) + 1;
    stepBody(world, body, input, TICK_DT);
    this.pending.push({
      serverTick: this.projectedServerTick,
      input,
    });
    if (this.pending.length > PREDICTION_HISTORY_LIMIT) this.pending.shift();
    return this.seq;
  }

  /** Drop prediction steps covered by server time, then replay only genuinely newer work. */
  reconcile(world: World, body: BodyState, authoritativeTick: number): void {
    this.projectedServerTick = Math.max(this.projectedServerTick ?? authoritativeTick, authoritativeTick);
    this.pending = this.pending.filter((step) => step.serverTick > authoritativeTick);
    for (const p of this.pending) stepBody(world, body, p.input, TICK_DT);
  }
}
