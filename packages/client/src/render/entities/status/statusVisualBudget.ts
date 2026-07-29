export interface StatusVisualBudget {
  readonly maximumActiveRigs: number;
  readonly maximumSpareRigs: number;
  readonly particleSlotsPerRig: number;
  readonly emberIntervalMs: number;
  readonly oilDropIntervalMs: number;
}

const FULL_BUDGET: StatusVisualBudget = {
  maximumActiveRigs: 32,
  maximumSpareRigs: 8,
  particleSlotsPerRig: 4,
  emberIntervalMs: 110,
  oilDropIntervalMs: 180,
};

const REDUCED_BUDGET: StatusVisualBudget = {
  maximumActiveRigs: 16,
  maximumSpareRigs: 4,
  particleSlotsPerRig: 2,
  emberIntervalMs: 240,
  oilDropIntervalMs: 360,
};

export function statusVisualBudgetFor(reducedMotion: boolean, mobile: boolean): StatusVisualBudget {
  return reducedMotion || mobile ? REDUCED_BUDGET : FULL_BUDGET;
}

export function defaultStatusVisualBudget(): StatusVisualBudget {
  const reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const mobile = (globalThis.navigator?.maxTouchPoints ?? 0) > 0;
  return statusVisualBudgetFor(reducedMotion, mobile);
}
