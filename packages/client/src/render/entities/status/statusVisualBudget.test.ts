import { describe, expect, it } from "vitest";
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
});
