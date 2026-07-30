import { describe, expect, it } from "vitest";
import {
  CONSTRAINED_DEVICE_PRESENTATION_PROFILE,
  DESKTOP_DEVICE_PRESENTATION_PROFILE,
} from "../../../presentation/devicePresentationProfile.js";
import { statusVisualBudgetFor } from "./statusVisualBudget.js";

describe("status visual budgets", () => {
  it("reduces active rigs, particles, and emission cadence for mobile or reduced motion", () => {
    const full = statusVisualBudgetFor(false, false);
    const reduced = statusVisualBudgetFor(true, false);
    const mobile = statusVisualBudgetFor(false, true);
    expect(reduced.maximumActiveRigs).toBeLessThan(full.maximumActiveRigs);
    expect(reduced.fireSparkSlots).toBeLessThan(full.fireSparkSlots);
    expect(reduced.poisonGasSlots).toBeLessThan(full.poisonGasSlots);
    expect(reduced.fireSparkIntervalMs).toBeGreaterThan(full.fireSparkIntervalMs);
    expect(reduced.poisonGasIntervalMs).toBeGreaterThan(full.poisonGasIntervalMs);
    expect(mobile).toBe(reduced);
  });

  it("reduces status VFX for low-hardware constrained profiles", () => {
    const desktop = statusVisualBudgetFor(
      false,
      false,
      DESKTOP_DEVICE_PRESENTATION_PROFILE,
    );
    const constrained = statusVisualBudgetFor(
      false,
      false,
      CONSTRAINED_DEVICE_PRESENTATION_PROFILE,
    );

    expect(constrained).toBe(statusVisualBudgetFor(true, false));
    expect(constrained.maximumActiveRigs).toBeLessThan(desktop.maximumActiveRigs);
    expect(constrained.poisonGasSlots).toBeLessThan(desktop.poisonGasSlots);
    expect(constrained.poisonGasIntervalMs).toBeGreaterThan(desktop.poisonGasIntervalMs);
  });

  it("keeps desktop status VFX at the full budget", () => {
    expect(statusVisualBudgetFor(false, false, DESKTOP_DEVICE_PRESENTATION_PROFILE))
      .toBe(statusVisualBudgetFor(false, false));
  });
});
