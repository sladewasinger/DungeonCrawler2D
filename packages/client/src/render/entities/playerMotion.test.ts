// Headless tests for inferring a remote player's visual anim state from position deltas.
import { MOVE_SPEED, RUN_SPEED_MULTIPLIER } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { inferPlayerAnimState, isRunningPace } from "./playerMotion.js";

describe("inferPlayerAnimState", () => {
  it("attack always wins, regardless of motion", () => {
    expect(inferPlayerAnimState(5, 5, 0.1, true)).toBe("attack");
    expect(inferPlayerAnimState(0, 0, 0.1, true)).toBe("attack");
  });

  it("is idle with no elapsed time to measure a delta over", () => {
    expect(inferPlayerAnimState(1, 1, 0, false)).toBe("idle");
  });

  it("is walk above the moving-speed threshold, idle below it", () => {
    expect(inferPlayerAnimState(2, 0, 0.5, false)).toBe("walk");
    expect(inferPlayerAnimState(0.01, 0, 0.5, false)).toBe("idle");
  });
});

describe("isRunningPace", () => {
  it("is false with no elapsed time to measure a delta over", () => {
    expect(isRunningPace(5, 0, 0)).toBe(false);
  });

  it("is false at ordinary walk speed and true at run speed", () => {
    expect(isRunningPace(MOVE_SPEED * 0.5, 0, 0.5)).toBe(false);
    expect(isRunningPace(
      MOVE_SPEED * RUN_SPEED_MULTIPLIER * 0.5,
      0,
      0.5,
    )).toBe(true);
  });
});
