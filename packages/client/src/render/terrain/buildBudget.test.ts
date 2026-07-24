import { describe, expect, it } from "vitest";
import { runBuildBudget } from "./buildBudget.js";

describe("runBuildBudget", () => {
  it("always advances one step so background work cannot starve", () => {
    let pending = 2;
    const steps = runBuildBudget(
      () => pending > 0,
      () => pending--,
      0,
      () => 10,
    );
    expect(steps).toBe(1);
    expect(pending).toBe(1);
  });

  it("stops advancing once the frame budget is consumed", () => {
    let pending = 10;
    let elapsed = 0;
    const steps = runBuildBudget(
      () => pending > 0,
      () => {
        pending--;
        elapsed += 2;
      },
      5,
      () => elapsed,
    );
    expect(steps).toBe(3);
    expect(pending).toBe(7);
  });

  it("stops immediately when all work completes", () => {
    let pending = 2;
    const steps = runBuildBudget(
      () => pending > 0,
      () => pending--,
      100,
      () => 0,
    );
    expect(steps).toBe(2);
  });
});
