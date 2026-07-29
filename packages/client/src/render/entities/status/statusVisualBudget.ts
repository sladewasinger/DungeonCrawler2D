import { STATUS_VISUAL_BUDGETS } from "../combat/statusVisualStyle.js";

export interface StatusVisualBudget {
  readonly maximumActiveRigs: number;
  readonly maximumSpareRigs: number;
  readonly fireSparkSlots: number;
  readonly oilDropSlots: number;
  readonly poisonGasSlots: number;
  readonly fireSparkIntervalMs: number;
  readonly oilDropIntervalMs: number;
  readonly poisonGasIntervalMs: number;
}

const FULL_BUDGET: StatusVisualBudget = STATUS_VISUAL_BUDGETS.full;
const REDUCED_BUDGET: StatusVisualBudget = STATUS_VISUAL_BUDGETS.reduced;

export function statusVisualBudgetFor(reducedMotion: boolean, mobile: boolean): StatusVisualBudget {
  return reducedMotion || mobile ? REDUCED_BUDGET : FULL_BUDGET;
}

export function defaultStatusVisualBudget(): StatusVisualBudget {
  const reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const mobile = (globalThis.navigator?.maxTouchPoints ?? 0) > 0;
  return statusVisualBudgetFor(reducedMotion, mobile);
}
