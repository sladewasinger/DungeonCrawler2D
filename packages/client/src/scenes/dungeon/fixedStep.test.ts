import { describe, expect, it } from "vitest";
import { STEP_MS, consumeFixedSteps, interpolationAlpha, lerp } from "./fixedStep.js";

describe("consumeFixedSteps", () => {
  it("owes zero steps when the frame delta doesn't cover one tick", () => {
    const result = consumeFixedSteps(0, STEP_MS / 2);
    expect(result.steps).toBe(0);
    expect(result.accumulatorMs).toBeCloseTo(STEP_MS / 2);
  });

  it("owes exactly one step for a delta matching the tick rate", () => {
    const result = consumeFixedSteps(0, STEP_MS);
    expect(result.steps).toBe(1);
    expect(result.accumulatorMs).toBeCloseTo(0);
  });

  it("owes multiple steps after a stall, never losing leftover time", () => {
    const result = consumeFixedSteps(0, STEP_MS * 3.25);
    expect(result.steps).toBe(3);
    expect(result.accumulatorMs).toBeCloseTo(STEP_MS * 0.25);
  });
});

describe("interpolationAlpha", () => {
  it("is 0 right after a step and approaches 1 before the next", () => {
    expect(interpolationAlpha(0)).toBe(0);
    expect(interpolationAlpha(STEP_MS)).toBe(1);
    expect(interpolationAlpha(STEP_MS / 2)).toBeCloseTo(0.5);
  });

  it("clamps outside [0,1]", () => {
    expect(interpolationAlpha(-5)).toBe(0);
    expect(interpolationAlpha(STEP_MS * 5)).toBe(1);
  });
});

describe("lerp", () => {
  it("interpolates linearly", () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(-4, 4, 0.25)).toBe(-2);
  });
});
