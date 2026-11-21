import type { FloorBounds } from "../finiteFloorTypes.js";

export interface FiniteFloorWorkSummary {
  readonly loopCandidateEvaluations: number;
  readonly loopCellVisits: number;
  readonly loopBudgetExhausted: boolean;
}

export interface FiniteFloorWorkBudget {
  readonly maxLoopCandidateEvaluations: number;
  readonly maxLoopCellVisits: number;
  candidateEvaluations: number;
  cellVisits: number;
  exhausted: boolean;
  consumeCandidate(): boolean;
  consumeCell(): boolean;
  summary(): FiniteFloorWorkSummary;
}

export function createFiniteFloorWorkBudget(
  bounds: FloorBounds,
  targetLoopCount: number,
): FiniteFloorWorkBudget {
  const cellCount = bounds.width * bounds.height;
  return new BoundedFiniteFloorWorkBudget({
    maxLoopCandidateEvaluations: Math.max(256, targetLoopCount * 64),
    maxLoopCellVisits: cellCount * 2,
  });
}

class BoundedFiniteFloorWorkBudget implements FiniteFloorWorkBudget {
  candidateEvaluations = 0;
  cellVisits = 0;
  exhausted = false;

  constructor(
    readonly limits: Pick<FiniteFloorWorkBudget, "maxLoopCandidateEvaluations" | "maxLoopCellVisits">,
  ) {}

  get maxLoopCandidateEvaluations(): number { return this.limits.maxLoopCandidateEvaluations; }
  get maxLoopCellVisits(): number { return this.limits.maxLoopCellVisits; }

  consumeCandidate(): boolean {
    if (this.candidateEvaluations >= this.maxLoopCandidateEvaluations) {
      this.exhausted = true;
      return false;
    }
    this.candidateEvaluations += 1;
    return true;
  }

  consumeCell(): boolean {
    if (this.cellVisits >= this.maxLoopCellVisits) {
      this.exhausted = true;
      return false;
    }
    this.cellVisits += 1;
    return true;
  }

  summary(): FiniteFloorWorkSummary {
    return {
      loopCandidateEvaluations: this.candidateEvaluations,
      loopCellVisits: this.cellVisits,
      loopBudgetExhausted: this.exhausted,
    };
  }
}
