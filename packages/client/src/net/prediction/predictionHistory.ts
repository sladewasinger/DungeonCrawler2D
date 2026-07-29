import type { MoveInput } from "@dc2d/engine";

export const PREDICTION_HISTORY_LIMIT = 64;

export interface PredictedStep {
  projectedServerTick: number;
  input: MoveInput;
}

export class PredictionHistory {
  private readonly pending: PredictedStep[] = [];
  private readonly recycled: PredictedStep[] = [];
  private allocatedStepRecords = 0;

  get steps(): readonly PredictedStep[] {
    return this.pending;
  }

  get size(): number {
    return this.pending.length;
  }

  get allocatedCount(): number {
    return this.allocatedStepRecords;
  }

  clear(): void {
    for (const step of this.pending) this.recycle(step);
    this.pending.length = 0;
  }

  add(projectedServerTick: number, input: MoveInput): void {
    const recycled = this.recycled.pop();
    const step = recycled
      ? this.refresh(recycled, projectedServerTick, input)
      : this.allocate(projectedServerTick, input);
    this.pending.push(step);
    if (this.pending.length > PREDICTION_HISTORY_LIMIT) {
      const evicted = this.pending.shift();
      if (evicted) this.recycle(evicted);
    }
  }

  discardThrough(acknowledgedTick: number | null): void {
    if (acknowledgedTick === null) return;
    let retainedCount = 0;
    for (const step of this.pending) {
      if (step.projectedServerTick <= acknowledgedTick) {
        this.recycle(step);
        continue;
      }
      this.pending[retainedCount] = step;
      retainedCount++;
    }
    this.pending.length = retainedCount;
  }

  private allocate(projectedServerTick: number, input: MoveInput): PredictedStep {
    this.allocatedStepRecords++;
    return { projectedServerTick, input };
  }

  private refresh(
    step: PredictedStep,
    projectedServerTick: number,
    input: MoveInput,
  ): PredictedStep {
    step.projectedServerTick = projectedServerTick;
    step.input = input;
    return step;
  }

  private recycle(step: PredictedStep): void {
    if (this.recycled.length < PREDICTION_HISTORY_LIMIT) this.recycled.push(step);
  }
}
