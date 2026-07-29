import { describe, expect, it } from "vitest";
import { statusVisualBudgetFor } from "./statusVisualBudget.js";

describe("status visual budgets", () => {
  it("reduces active rigs, particles, and emission cadence for mobile or reduced motion", () => {
    const full = statusVisualBudgetFor(false, false);
    const reduced = statusVisualBudgetFor(true, false);
    const mobile = statusVisualBudgetFor(false, true);
    expect(reduced.maximumActiveRigs).toBeLessThan(full.maximumActiveRigs);
    expect(reduced.particleSlotsPerRig).toBeLessThan(full.particleSlotsPerRig);
    expect(reduced.emberIntervalMs).toBeGreaterThan(full.emberIntervalMs);
    expect(mobile).toBe(reduced);
  });
});
