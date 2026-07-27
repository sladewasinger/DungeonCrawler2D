// Headless tests for inferring a remote player's visual anim state from position deltas.
import { MOVE_SPEED, RUN_SPEED_MULTIPLIER } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { inferPlayerAnimState, isRunningPace } from "./playerMotion.js";

describe("inferPlayerAnimState", () => {
  it("attack always wins, regardless of motion", () => {
    expect(inferPlayerAnimState({ dxTiles: 5, dyTiles: 5, dtSeconds: 0.1, attacking: true })).toBe("attack");
    expect(inferPlayerAnimState({ dxTiles: 0, dyTiles: 0, dtSeconds: 0.1, attacking: true })).toBe("attack");
  });

  it("is idle with no elapsed time to measure a delta over", () => {
    expect(inferPlayerAnimState({ dxTiles: 1, dyTiles: 1, dtSeconds: 0, attacking: false })).toBe("idle");
  });

  it("is walk above the moving-speed threshold, idle below it", () => {
    expect(inferPlayerAnimState({ dxTiles: 2, dyTiles: 0, dtSeconds: 0.5, attacking: false })).toBe("walk");
    expect(inferPlayerAnimState({ dxTiles: 0.01, dyTiles: 0, dtSeconds: 0.5, attacking: false })).toBe("idle");
  });
});

describe("isRunningPace", () => {
  it("is false with no elapsed time to measure a delta over", () => {
    expect(isRunningPace({ dxTiles: 5, dyTiles: 0, dtSeconds: 0 })).toBe(false);
  });

  it("is false at ordinary walk speed and true at run speed", () => {
    expect(isRunningPace({ dxTiles: MOVE_SPEED * 0.5, dyTiles: 0, dtSeconds: 0.5 })).toBe(false);
    expect(isRunningPace({
      dxTiles: MOVE_SPEED * RUN_SPEED_MULTIPLIER * 0.5,
      dyTiles: 0,
      dtSeconds: 0.5,
    })).toBe(true);
  });
});
