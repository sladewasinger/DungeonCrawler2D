import { describe, expect, it } from "vitest";
import {
  MAX_SERVER_CATCH_UP_TICKS,
  fixedRateStepPlan,
} from "./fixedRateLoop.js";

describe("fixedRateStepPlan", () => {
  it("keeps a 20 Hz simulation aligned when host timer callbacks arrive at 17 Hz", () => {
    const tickMilliseconds = 50;
    let nextTickAt = tickMilliseconds;
    let simulatedTicks = 0;

    for (let now = 60; now <= 6_000; now += 60) {
      const plan = fixedRateStepPlan(now, nextTickAt, tickMilliseconds);
      nextTickAt = plan.nextTickAt;
      simulatedTicks += plan.steps;
    }

    expect(simulatedTicks).toBe(120);
    expect(nextTickAt).toBe(6_050);
  });

  it("bounds a long stall and drops only the excess backlog", () => {
    const plan = fixedRateStepPlan(10_000, 50, 50);

    expect(plan).toEqual({
      steps: MAX_SERVER_CATCH_UP_TICKS,
      nextTickAt: 10_050,
    });
  });
});
