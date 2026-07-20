import { describe, expect, it } from "vitest";
import { TICK_DT } from "../core/constants.js";
import type { WorldView } from "../world/types.js";
import { BODY_RADIUS, CORNER_SLIDE_WINDOW, createBody, stepBody } from "./movement/index.js";

/**
 * Corner-slide assist: explicit stepBody-level cases for the 1-tile
 * corridor-mouth stuck bug (Epic 7.13) — an off-center approach to a
 * 1-wide gap should glide through within the capture window and stay
 * legally blocked beyond it. See feel.test.ts for the same behavior
 * measured as a "feel" band via feel-harness.ts.
 */

/** A wall spanning one axis with a single 1-tile gap: `axis: "x"` is a
 * vertical wall (column at tileX === wallAt) with the opening at
 * tileY === gapAt, for east/west approaches; `axis: "y"` is horizontal,
 * for north/south approaches. */
function corridorWorld(axis: "x" | "y", wallAt: number, gapAt: number): WorldView {
  return {
    isWalkable: (tx, ty) => {
      const along = axis === "x" ? tx : ty;
      const perp = axis === "x" ? ty : tx;
      return along !== wallAt || perp === gapAt;
    },
    heightAt: () => 0,
    groundAt: () => 0,
  };
}

function crossedWall(axis: "x" | "y", move: { moveX: number; moveY: number }, wallAt: number, body: ReturnType<typeof createBody>): boolean {
  const along = axis === "x" ? body.x : body.y;
  const throughWall = axis === "x" ? move.moveX > 0 : move.moveY > 0;
  return throughWall ? along > wallAt + 1 : along < wallAt;
}

describe("corner-slide assist (1-tile corridor entry)", () => {
  const WALL_AT = 8;
  const GAP_AT = 10;
  const GAP_CENTER = GAP_AT + 0.5;
  // A 1-wide gap already has this much free alignment slack (both leading
  // corners land in the gap tile with no assist needed) before the assist
  // does anything at all.
  const NATURAL_TOLERANCE = 0.5 - BODY_RADIUS;
  // Beyond that free slack, still inside the assist's search radius —
  // should glide through, not stall.
  const WITHIN_WINDOW = NATURAL_TOLERANCE + CORNER_SLIDE_WINDOW - 0.05;
  // Past even the assist's reach — must stay blocked.
  const BEYOND_WINDOW = NATURAL_TOLERANCE + CORNER_SLIDE_WINDOW + 0.2;

  it.each([
    ["east", "x", { moveX: 1, moveY: 0 }, 5.5, GAP_CENTER + WITHIN_WINDOW] as const,
    ["west", "x", { moveX: -1, moveY: 0 }, 11.5, GAP_CENTER - WITHIN_WINDOW] as const,
    ["south", "y", { moveX: 0, moveY: 1 }, GAP_CENTER + WITHIN_WINDOW, 5.5] as const,
    ["north", "y", { moveX: 0, moveY: -1 }, GAP_CENTER - WITHIN_WINDOW, 11.5] as const,
  ])("%s: off-center within the window slides through the gap", (_dir, axis, move, sx, sy) => {
    const world = corridorWorld(axis, WALL_AT, GAP_AT);
    const body = createBody(sx, sy, 0);
    for (let i = 0; i < 60; i++) stepBody(world, body, { ...move, jump: false }, TICK_DT);
    expect(crossedWall(axis, move, WALL_AT, body)).toBe(true);
  });

  it.each([
    ["east", "x", { moveX: 1, moveY: 0 }, 5.5, GAP_CENTER + BEYOND_WINDOW] as const,
    ["west", "x", { moveX: -1, moveY: 0 }, 11.5, GAP_CENTER - BEYOND_WINDOW] as const,
    ["south", "y", { moveX: 0, moveY: 1 }, GAP_CENTER + BEYOND_WINDOW, 5.5] as const,
    ["north", "y", { moveX: 0, moveY: -1 }, GAP_CENTER - BEYOND_WINDOW, 11.5] as const,
  ])("%s: off-center beyond the window stays blocked", (_dir, axis, move, sx, sy) => {
    const world = corridorWorld(axis, WALL_AT, GAP_AT);
    const body = createBody(sx, sy, 0);
    for (let i = 0; i < 60; i++) stepBody(world, body, { ...move, jump: false }, TICK_DT);
    expect(crossedWall(axis, move, WALL_AT, body)).toBe(false);
  });

  it("never enters the wall/void it wasn't already allowed into (assist stays a legal move)", () => {
    // A dead end: no gap anywhere nearby, so no offset should ever unblock it.
    const world: WorldView = { isWalkable: (tx) => tx !== WALL_AT, heightAt: () => 0, groundAt: () => 0 };
    const body = createBody(5.5, GAP_CENTER, 0);
    for (let i = 0; i < 60; i++) stepBody(world, body, { moveX: 1, moveY: 0, jump: false }, TICK_DT);
    expect(body.x).toBeLessThan(WALL_AT);
  });
});
