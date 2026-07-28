import { describe, expect, it } from "vitest";
import { TICK_DT } from "../../../core/constants.js";
import type { WorldView } from "../../../world/core/types.js";
import { BODY_RADIUS, CORNER_SLIDE_WINDOW, createBody, stepBody } from "../../../index.js";

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
    stairHeightAt: () => null,
  };
}

function crossedWall(...[axis, move, wallAt, body]: ["x" | "y", { moveX: number; moveY: number }, number, ReturnType<typeof createBody>]): boolean {
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

  interface CorridorCase { dir: string; axis: "x" | "y"; move: { moveX: number; moveY: number }; sx: number; sy: number }
  const casesFor = (offset: number): CorridorCase[] => [
    { dir: "east", axis: "x", move: { moveX: 1, moveY: 0 }, sx: 5.5, sy: GAP_CENTER + offset },
    { dir: "west", axis: "x", move: { moveX: -1, moveY: 0 }, sx: 11.5, sy: GAP_CENTER - offset },
    { dir: "south", axis: "y", move: { moveX: 0, moveY: 1 }, sx: GAP_CENTER + offset, sy: 5.5 },
    { dir: "north", axis: "y", move: { moveX: 0, moveY: -1 }, sx: GAP_CENTER - offset, sy: 11.5 },
  ];

  it.each(casesFor(WITHIN_WINDOW))("$dir: off-center within the window slides through the gap", ({ axis, move, sx, sy }) => {
    const world = corridorWorld(axis, WALL_AT, GAP_AT);
    const body = createBody(sx, sy, 0);
    for (let i = 0; i < 60; i++) stepBody(world, body, { ...move, jump: false }, TICK_DT);
    expect(crossedWall(axis, move, WALL_AT, body)).toBe(true);
  });

  it.each(casesFor(BEYOND_WINDOW))("$dir: off-center beyond the window stays blocked", ({ axis, move, sx, sy }) => {
    const world = corridorWorld(axis, WALL_AT, GAP_AT);
    const body = createBody(sx, sy, 0);
    for (let i = 0; i < 60; i++) stepBody(world, body, { ...move, jump: false }, TICK_DT);
    expect(crossedWall(axis, move, WALL_AT, body)).toBe(false);
  });

  it("never enters the wall/void it wasn't already allowed into (assist stays a legal move)", () => {
    // A dead end: no gap anywhere nearby, so no offset should ever unblock it.
    const world: WorldView = {
      isWalkable: (tx) => tx !== WALL_AT,
      heightAt: () => 0,
      groundAt: () => 0,
      stairHeightAt: () => null,
    };
    const body = createBody(5.5, GAP_CENTER, 0);
    for (let i = 0; i < 60; i++) stepBody(world, body, { moveX: 1, moveY: 0, jump: false }, TICK_DT);
    expect(body.x).toBeLessThan(WALL_AT);
  });
});

describe("corner escape", () => {
  it("lets a body walk out of a lower-floor corner after jumping into it", () => {
    const world: WorldView = {
      isWalkable: () => true,
      heightAt: (x, y) => Math.floor(x) >= 0 && Math.floor(y) >= 0 ? -1 : 0,
      groundAt: (x, y) => Math.floor(x) >= 0 && Math.floor(y) >= 0 ? -1 : 0,
      stairHeightAt: () => null,
    };
    const body = createBody(0, 0, -1);

    for (let tick = 0; tick < 8; tick++) stepBody(world, body, { moveX: 1, moveY: 0, jump: false }, TICK_DT);

    expect(body.x).toBeGreaterThan(BODY_RADIUS);
    expect(body.y).toBeGreaterThan(BODY_RADIUS);
    expect(body.z).toBe(-1);
  });
});
