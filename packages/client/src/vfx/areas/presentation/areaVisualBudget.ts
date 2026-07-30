import { AREA_VISUAL_BUDGETS } from "./areaVisualStyle.js";
import {
  DESKTOP_DEVICE_PRESENTATION_PROFILE,
  type DevicePresentationProfile,
} from "../../../presentation/devicePresentationProfile.js";

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
  deviceProfile: DevicePresentationProfile = DESKTOP_DEVICE_PRESENTATION_PROFILE,
): AreaVisualBudget {
  return reducedEffects || mobile || deviceProfile.kind === "constrained"
    ? AREA_VISUAL_BUDGETS.reduced
    : AREA_VISUAL_BUDGETS.full;
}

export function defaultAreaVisualBudget(
  deviceProfile: DevicePresentationProfile = DESKTOP_DEVICE_PRESENTATION_PROFILE,
): AreaVisualBudget {
  const reducedEffects = userReducedEffects() || systemReducedMotion();
  const mobile = (globalThis.navigator?.maxTouchPoints ?? 0) > 0;
  return areaVisualBudgetFor(reducedEffects, mobile, deviceProfile);
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
