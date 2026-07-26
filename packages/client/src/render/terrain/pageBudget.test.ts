import { describe, expect, it } from "vitest";
import { PageBudget } from "./pageBudget.js";

describe("PageBudget", () => {
  it("enforces active bytes independently from spare bytes", () => {
    const budget = new PageBudget({ activeBytes: 12, spareBytes: 8 });
    expect(budget.activateNew(8)).toBe(true);
    expect(budget.activateNew(8)).toBe(false);
    expect(budget.snapshot()).toMatchObject({ activeUsedBytes: 8, spareUsedBytes: 0 });
  });

  it("moves released pages between active and spare ledgers", () => {
    const budget = new PageBudget({ activeBytes: 12, spareBytes: 8 });
    expect(budget.activateNew(8)).toBe(true);
    expect(budget.releaseToSpare(8)).toBe(true);
    expect(budget.snapshot()).toMatchObject({ activeUsedBytes: 0, spareUsedBytes: 8 });
    expect(budget.activateSpare(8)).toBe(true);
    expect(budget.snapshot()).toMatchObject({ activeUsedBytes: 8, spareUsedBytes: 0 });
  });

  it("requires destruction when a release would exceed the spare budget", () => {
    const budget = new PageBudget({ activeBytes: 16, spareBytes: 4 });
    expect(budget.activateNew(8)).toBe(true);
    expect(budget.releaseToSpare(8)).toBe(false);
    expect(budget.snapshot()).toMatchObject({ activeUsedBytes: 0, spareUsedBytes: 0 });
  });
});
