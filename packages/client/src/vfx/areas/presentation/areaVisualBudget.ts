import { AREA_VISUAL_BUDGETS } from "./areaVisualStyle.js";

export interface AreaVisualBudget {
  readonly maximumFireRigs: number;
  readonly maximumPoisonRigs: number;
  readonly maximumSteamRigs: number;
  readonly maximumPoisonBubbles: number;
  readonly maximumSpareRigsPerKind: number;
  readonly emissionFrequencyScale: number;
}

export function areaVisualBudgetFor(
  reducedEffects: boolean,
  mobile: boolean,
): AreaVisualBudget {
  return reducedEffects || mobile
    ? AREA_VISUAL_BUDGETS.reduced
    : AREA_VISUAL_BUDGETS.full;
}

export function defaultAreaVisualBudget(): AreaVisualBudget {
  const reducedEffects = userReducedEffects() || systemReducedMotion();
  const mobile = (globalThis.navigator?.maxTouchPoints ?? 0) > 0;
  return areaVisualBudgetFor(reducedEffects, mobile);
}

function userReducedEffects(): boolean {
  const document = globalThis.document;
  return document
    ? document.querySelector("[data-reduced-motion='true']") !== null
    : false;
}

function systemReducedMotion(): boolean {
  return globalThis.matchMedia
    ?.("(prefers-reduced-motion: reduce)").matches ?? false;
}
