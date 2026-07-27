import { describe, expect, it } from "vitest";
import {
  MAX_STEPS_PER_FRAME,
  STEP_MS,
  consumeFixedSteps,
} from "./fixedStep.js";

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

  it("bounds catch-up work and discards overdue whole ticks after a long stall", () => {
    const result = consumeFixedSteps(STEP_MS * 0.25, STEP_MS * 20);
    expect(result.steps).toBe(MAX_STEPS_PER_FRAME);
    expect(result.accumulatorMs).toBeCloseTo(STEP_MS * 0.25);
  });
});

