import { describe, expect, it } from "vitest";
import {
  CONSTRAINED_DEVICE_PRESENTATION_PROFILE,
  DESKTOP_DEVICE_PRESENTATION_PROFILE,
} from "../../../presentation/devicePresentationProfile.js";
import { areaVisualBudgetFor } from "./areaVisualBudget.js";

describe("area visual budgets", () => {
  it("uses the same constrained budget for mobile and reduced effects", () => {
    const full = areaVisualBudgetFor(false, false);
    const reduced = areaVisualBudgetFor(true, false);
    expect(areaVisualBudgetFor(false, true)).toBe(reduced);
    expect(reduced.maximumFireRigs).toBeLessThan(full.maximumFireRigs);
    expect(reduced.maximumPoisonRigs).toBeLessThan(full.maximumPoisonRigs);
    expect(reduced.emissionFrequencyScale).toBeGreaterThan(1);
  });

  it("reduces area VFX for low-hardware constrained profiles", () => {
    const desktop = areaVisualBudgetFor(
      false,
      false,
      DESKTOP_DEVICE_PRESENTATION_PROFILE,
    );
    const constrained = areaVisualBudgetFor(
      false,
      false,
      CONSTRAINED_DEVICE_PRESENTATION_PROFILE,
    );

    expect(constrained).toBe(areaVisualBudgetFor(true, false));
    expect(constrained.maximumFireRigs).toBeLessThan(desktop.maximumFireRigs);
    expect(constrained.maximumPoisonBubbles).toBeLessThan(desktop.maximumPoisonBubbles);
    expect(constrained.emissionFrequencyScale).toBeGreaterThan(desktop.emissionFrequencyScale);
  });

  it("keeps desktop area VFX at the full budget", () => {
    expect(areaVisualBudgetFor(false, false, DESKTOP_DEVICE_PRESENTATION_PROFILE))
      .toBe(areaVisualBudgetFor(false, false));
  });
});
