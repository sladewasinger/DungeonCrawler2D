import { describe, expect, it } from "vitest";
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
});
