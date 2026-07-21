import { stairwayDownPosition } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { STAIRWAY_NEAR_TILES, resolveStairwayTick } from "./stairwayTick.js";

const SEED = 1337;
const WORLD = { worldSeed: SEED, floor: 1 };
// The deterministic landmark the tick must point at — the test only borrows its
// POSITION (the same seam the shipped code reads); every expected bearing below is
// hand-derived from the player's offset relative to it, never from the implementation.
const TARGET = stairwayDownPosition(WORLD)!;

describe("resolveStairwayTick", () => {
  // Player 20 tiles SOUTH of the stairway (stairs due world-NORTH, world bearing 0).
  // Hand-derived screen bearings: the tick renders wherever the dial's N letter sits.
  //   view bearing 0   (north-up view) -> tick screen-up    (0)
  //   view bearing 270 (east-up view)  -> tick screen-left  (270)
  //   view bearing 180 (south-up view) -> tick screen-down  (180)
  //   view bearing 90  (west-up view)  -> tick screen-right (90)
  it.each([
    [0, 0],
    [270, 270],
    [180, 180],
    [90, 90],
  ])("stairs due north, view bearing %i -> screen bearing %i", (view, expected) => {
    const tick = resolveStairwayTick(WORLD, TARGET.x, TARGET.y + 20, view);
    expect(tick?.screenBearingDeg).toBeCloseTo(expected, 6);
  });

  // Player 20 tiles WEST of the stairway (stairs due world-EAST, world bearing 90).
  // Hand-derived: east sits 90 degrees clockwise of wherever north renders.
  //   view bearing 0   -> 90  (screen-right)
  //   view bearing 270 -> 0   (screen-up: east-up view, stairs dead ahead)
  //   view bearing 180 -> 270 (screen-left)
  //   view bearing 90  -> 180 (screen-down)
  it.each([
    [0, 90],
    [270, 0],
    [180, 270],
    [90, 180],
  ])("stairs due east, view bearing %i -> screen bearing %i", (view, expected) => {
    const tick = resolveStairwayTick(WORLD, TARGET.x - 20, TARGET.y, view);
    expect(tick?.screenBearingDeg).toBeCloseTo(expected, 6);
  });

  it("resolves a diagonal: 3 east + 4 north of the player is atan2(3,4) = 36.87 degrees at north-up", () => {
    // Player at (target.x - 3, target.y + 4): dx=3, dy=-4 — the 3-4-5 triangle.
    const tick = resolveStairwayTick(WORLD, TARGET.x - 3, TARGET.y + 4, 0);
    expect(tick?.screenBearingDeg).toBeCloseTo((Math.atan2(3, 4) * 180) / Math.PI, 6);
    expect(tick?.near).toBe(true); // hypot(3,4) = 5 <= 8
  });

  it("pulses exactly at the near threshold and not one step beyond", () => {
    // Due south at exactly 8 tiles: hypot = 8 <= 8 -> near.
    expect(resolveStairwayTick(WORLD, TARGET.x, TARGET.y + STAIRWAY_NEAR_TILES, 0)?.near).toBe(true);
    // Diagonal 6+6: hypot = 8.485... > 8 -> not near.
    expect(resolveStairwayTick(WORLD, TARGET.x + 6, TARGET.y + 6, 0)?.near).toBe(false);
    // 20 tiles out: far.
    expect(resolveStairwayTick(WORLD, TARGET.x, TARGET.y + 20, 0)?.near).toBe(false);
  });

  it("returns null on the boss floor (FLOOR_CAP has no StairwayDown)", () => {
    expect(resolveStairwayTick({ worldSeed: SEED, floor: 5 }, 0, 0, 0)).toBeNull();
  });
});
