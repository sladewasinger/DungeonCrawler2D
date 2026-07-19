import { TICK_DT, stepBody, type BodyState, type MoveInput, type World } from "@dc2d/engine";

/**
 * Client-side movement prediction: the local body advances through the
 * same engine stepBody the server runs, and unacked inputs are replayed
 * on top of each authoritative snapshot (reconciliation).
 */
export class Prediction {
  private seq = 0;
  private pending: Array<{ seq: number; input: MoveInput }> = [];

  reset(): void {
    this.pending = [];
  }

  /** Advance the local body one tick and remember the input for replay. */
  predict(world: World, body: BodyState, input: MoveInput): number {
    this.seq++;
    stepBody(world, body, input, TICK_DT);
    this.pending.push({ seq: this.seq, input });
    if (this.pending.length > 60) this.pending.shift();
    return this.seq;
  }

  /** Drop server-acked inputs, replay the rest onto the authoritative body. */
  reconcile(world: World, body: BodyState, lastAckedSeq: number): void {
    this.pending = this.pending.filter((p) => p.seq > lastAckedSeq);
    for (const p of this.pending) stepBody(world, body, p.input, TICK_DT);
  }
}
