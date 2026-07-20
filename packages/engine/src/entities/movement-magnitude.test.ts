import { describe, expect, it } from "vitest";
import { MOVE_SPEED, TICK_DT } from "../core/constants.js";
import type { WorldView } from "../world/types.js";
import { CORNER_SLIDE_WINDOW, createBody, stepBody } from "./movement/index.js";

/**
 * Analog movement magnitude: the (moveX, moveY) vector's length scales
 * walk speed, clamped to 1 — this is the stepBody-level contract an
 * analog source (touch stick) relies on, and the guarantee that
 * keyboard's existing -1/0/1 axes feel byte-identical to before.
 */

const OPEN_WORLD: WorldView = { isWalkable: () => true, heightAt: () => 0, groundAt: () => 0 };

function walk(moveX: number, moveY: number, ticks: number): { x: number; y: number } {
  const body = createBody(5.5, 5.5, 0);
  for (let i = 0; i < ticks; i++) stepBody(OPEN_WORLD, body, { moveX, moveY, jump: false }, TICK_DT);
  return { x: body.x - 5.5, y: body.y - 5.5 };
}

describe("analog movement magnitude", () => {
  it("moves at exactly half speed for a 0.5-magnitude single-axis input", () => {
    const moved = walk(0.5, 0, 20);
    expect(moved.x).toBeCloseTo(0.5 * MOVE_SPEED * (20 * TICK_DT), 6);
  });

  it("moves at exactly 0.2x speed for a 0.2-magnitude single-axis input", () => {
    const moved = walk(0.2, 0, 20);
    expect(moved.x).toBeCloseTo(0.2 * MOVE_SPEED * (20 * TICK_DT), 6);
  });

  it("keyboard's unit axis (1, 0) is byte-identical to pre-analog MOVE_SPEED", () => {
    const moved = walk(1, 0, 20);
    expect(moved.x).toBeCloseTo(MOVE_SPEED * (20 * TICK_DT), 6);
  });

  it("keyboard's raw diagonal (1, 1) normalizes to the same speed as a pre-normalized (0.707, 0.707)", () => {
    const raw = walk(1, 1, 20);
    const preNormalized = walk(Math.SQRT1_2, Math.SQRT1_2, 20);
    expect(raw.x).toBeCloseTo(preNormalized.x, 9);
    expect(raw.y).toBeCloseTo(preNormalized.y, 9);
    // Overall speed never exceeds base MOVE_SPEED on a diagonal, matching
    // the pre-analog behavior exactly (SQRT1_2 * SQRT1_2 * 2 === 1).
    const distance = Math.hypot(raw.x, raw.y);
    expect(distance).toBeCloseTo(MOVE_SPEED * (20 * TICK_DT), 6);
  });

  it("an analog vector past unit length clamps to exactly 1 (direction preserved, no speedup)", () => {
    const overshoot = walk(0.9, 0.9, 20); // magnitude ~1.27
    const clampedDiagonal = walk(Math.SQRT1_2, Math.SQRT1_2, 20);
    expect(overshoot.x).toBeCloseTo(clampedDiagonal.x, 6);
    expect(overshoot.y).toBeCloseTo(clampedDiagonal.y, 6);
  });

  it("neutral input (0, 0) never moves", () => {
    const moved = walk(0, 0, 20);
    expect(moved.x).toBe(0);
    expect(moved.y).toBe(0);
  });

  it("corner-slide assist respects a scaled (analog) speed budget — no overshoot past the reduced per-tick travel", () => {
    // Same 1-wide gap fixture as movement-corner-slide.test.ts, approached
    // off-center within the assist's window, but at half analog magnitude.
    const WALL_AT = 8;
    const GAP_AT = 10;
    const GAP_CENTER = GAP_AT + 0.5;
    const world: WorldView = {
      isWalkable: (tx, ty) => tx !== WALL_AT || ty === GAP_AT,
      heightAt: () => 0,
      groundAt: () => 0,
    };
    const offset = CORNER_SLIDE_WINDOW - 0.05;
    const body = createBody(5.5, GAP_CENTER + offset, 0);
    const magnitude = 0.5;
    const perTickBudget = MOVE_SPEED * magnitude * TICK_DT;
    for (let i = 0; i < 200 && body.x < WALL_AT + 1; i++) {
      const prevX = body.x;
      const prevY = body.y;
      stepBody(world, body, { moveX: magnitude, moveY: 0, jump: false }, TICK_DT);
      // Neither axis moves further in one tick than the scaled speed allows,
      // even while the corner-slide nudge is actively steering the body.
      expect(Math.abs(body.x - prevX)).toBeLessThanOrEqual(perTickBudget + 1e-9);
      expect(Math.abs(body.y - prevY)).toBeLessThanOrEqual(perTickBudget + 1e-9);
    }
    expect(body.x).toBeGreaterThan(WALL_AT);
  });
});
