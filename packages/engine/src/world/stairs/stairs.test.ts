import { describe, expect, it } from "vitest";
import { MOVE_SPEED, TICK_DT } from "../../core/constants.js";
import { createBody, stepBody } from "../../entities/movement/index.js";
import { stairRampAt, type StairView } from "./stairs.js";
import { TILE, type WorldView } from "../core/types.js";

/**
 * Generator-independent stair fixtures: hand-built WorldView/StairView
 * geometry rather than a scan over any particular chunk generator's
 * output. Which generator is wired in as World's default is free to
 * change; these physics
 * assertions only care about the shape of a staircase.
 */

const STAIR_X = 100;
const STAIR_Y = 100;

/**
 * A hand-built 2-wide south-entry staircase, matching the shape
 * twoWideSouthEntry below exercises for sideways crossing: a flat
 * height-0 approach south of the run, a height-0.5 stair row at STAIR_Y
 * (columns STAIR_X/STAIR_X+1), and a raised height-1 interior north of
 * it — the z-scale doctrine's single tile-edge rise, ramping 0 -> 1.
 * Flanking columns are plain floor at whatever height their row implies
 * — no ramp. Exposes the full WorldView contract (not just StairView)
 * so real body physics can be driven across it.
 */
function southEntryWorld(): WorldView & StairView {
  const stairCols = new Set([STAIR_X, STAIR_X + 1]);
  const heightAt = (wx: number, wy: number): number => {
    if (wy === STAIR_Y && stairCols.has(wx)) return 0.5;
    return wy < STAIR_Y ? 1 : 0;
  };
  const tileAt = (wx: number, wy: number): number =>
    wy === STAIR_Y && stairCols.has(wx) ? TILE.Stairs : TILE.Floor;
  const groundAt = (x: number, y: number): number =>
    stairRampAt({ tileAt, heightAt }, x, y) ?? heightAt(Math.floor(x), Math.floor(y));
  const stairHeightAt = (x: number, y: number): number | null =>
    tileAt(Math.floor(x), Math.floor(y)) === TILE.Stairs ? stairRampAt({ tileAt, heightAt }, x, y) : null;
  return { tileAt, heightAt, isWalkable: () => true, groundAt, stairHeightAt };
}

describe("stairs as physical ramps", () => {
  const world = southEntryWorld();
  const entry = { x: STAIR_X, y: STAIR_Y };

  // Re-baselined for RUN_PADDING retired to 0 (docs/R2-STAIRS-SPEC.md,
  // Wave R2): a lone Stairs tile's ramp is now exactly its own physical
  // extent — flush with the low neighbor at one edge, the high neighbor
  // at the other, nothing beyond. The old test asserted a virtual
  // "two-and-a-half-tile" run; that padding is gone by design.
  it("ramps linearly across the stair's own single physical tile, flush at both edges", () => {
    const { x, y } = entry;
    // South of the tile: flat at the low anchor (stairRampAt itself is
    // null this far out; groundAt falls back to the flat neighbor height).
    expect(stairRampAt(world, x + 0.5, y + 1.001)).toBeNull();
    expect(world.groundAt(x + 0.5, y + 1.5)).toBe(0);
    // Within the tile [y, y+1]: linear from the high edge (y) to the low edge (y+1).
    expect(stairRampAt(world, x + 0.5, y)).toBeCloseTo(1, 5);
    expect(stairRampAt(world, x + 0.5, y + 0.25)).toBeCloseTo(0.75, 5);
    expect(stairRampAt(world, x + 0.5, y + 0.5)).toBeCloseTo(0.5, 5);
    expect(stairRampAt(world, x + 0.5, y + 0.75)).toBeCloseTo(0.25, 5);
    expect(stairRampAt(world, x + 0.5, y + 1)).toBeCloseTo(0, 5);
    // North of the tile: flat at the high anchor.
    expect(world.groundAt(x + 0.5, y - 0.5)).toBe(1);
  });

  it("climbs via the on-stair glide, staying grounded the whole way, flat right up until the physical tile", () => {
    const { x, y } = entry;
    const body = createBody(x + 0.5, y + 3.5, 0);
    let roseBeforeTile = false;
    let maxTickRise = 0;
    for (let i = 0; i < 30; i++) {
      const prevZ = body.z;
      stepBody(world, body, { moveX: 0, moveY: -1, jump: false }, TICK_DT);
      expect(body.grounded).toBe(true);
      if (body.y > y + 1 && body.z > 0) roseBeforeTile = true;
      maxTickRise = Math.max(maxTickRise, body.z - prevZ);
    }
    expect(body.z).toBeCloseTo(1, 5);
    expect(roseBeforeTile).toBe(false);
    expect(maxTickRise).toBeCloseTo(MOVE_SPEED * TICK_DT, 5);
  });

  function climbToPartialHeight(body: ReturnType<typeof createBody>): void {
    for (let tick = 0; tick < 30; tick++) {
      if (body.z >= 0.2) return;
      stepBody(world, body, { moveX: 0, moveY: -1, jump: false }, TICK_DT);
    }
  }

  function fallOffStairSide(body: ReturnType<typeof createBody>, x: number): number | null {
    const sideOpen = isOpenStairSide(body, x);
    for (let tick = 0; tick < 60; tick++) {
      const result = stepBody(world, body, { moveX: sideOpen ? 1 : -1, moveY: 0, jump: false }, TICK_DT);
      if (result.landed) return result.landed.fallHeight;
    }
    return null;
  }

  function isOpenStairSide(body: ReturnType<typeof createBody>, x: number): boolean {
    const neighborY = Math.floor(body.y);
    return world.tileAt(x + 1, neighborY) === TILE.Floor && world.heightAt(x + 1, neighborY) < body.z;
  }

  it("falls from partial height when leaving the stair's side", () => {
    const { x, y } = entry;
    const body = createBody(x + 0.5, y + 3.5, 0);
    climbToPartialHeight(body);
    expect(body.z).toBeGreaterThan(0.1);
    expect(body.z).toBeLessThan(1);
    const fell = fallOffStairSide(body, x);
    if (fell !== null) expect(fell).toBeLessThan(1);
    expect(body.z).toBeCloseTo(world.groundAt(body.x, body.y), 5);
  });

  it("descends the same run entering from the high end, with no airborne flicker", () => {
    const { x, y } = entry;
    const body = createBody(x + 0.5, y - 1.5, 1);
    let flicker = 0;
    for (let i = 0; i < 30; i++) {
      stepBody(world, body, { moveX: 0, moveY: 1, jump: false }, TICK_DT);
      if (!body.grounded) flicker++;
    }
    expect(flicker).toBe(0);
    expect(body.z).toBeCloseTo(0, 5);
  });

  it("lands correctly when falling onto the ramp mid-descent while moving across it", () => {
    const { x, y } = entry;
    const body = createBody(x + 0.5, y + 2.499, 6);
    let landings = 0;
    let landedZ = -1;
    // Stop at the first landing: further travel walks off the terrace's
    // far (unramped, by design) edge into a second, unrelated fall.
    for (let i = 0; i < 80 && landings === 0; i++) {
      const r = stepBody(world, body, { moveX: 0, moveY: -1, jump: false }, TICK_DT);
      if (r.landed) {
        landings++;
        landedZ = body.z;
      }
    }
    expect(landings).toBe(1); // one clean landing, no double-land off the ramp
    expect(landedZ).toBeCloseTo(world.groundAt(body.x, body.y), 4);
  });
});

describe("stair width: walking across a run sideways", () => {
  /** Mimics terraces.ts's 2-wide south entry: stair columns 10-11 at row
   * y=10 (height 0.5), raised interior north of it (y<10, height 1), flat
   * approach south of it (y>10, height 0). Flanking columns 9 and 12 are
   * plain floor at whatever height their row implies (no ramp). */
  function twoWideSouthEntry(): StairView {
    const stairCols = new Set([10, 11]);
    return {
      tileAt: (wx, wy) => (wy === 10 && stairCols.has(wx) ? TILE.Stairs : TILE.Floor),
      heightAt: (wx, wy) => {
        if (wy === 10 && stairCols.has(wx)) return 0.5;
        return wy < 10 ? 1 : 0;
      },
    };
  }

  it("both columns of a 2-wide run ramp identically at the same row", () => {
    const view = twoWideSouthEntry();
    for (const y of [10.9, 10.5, 10.1]) {
      expect(stairRampAt(view, 10.5, y)).toBeCloseTo(stairRampAt(view, 11.5, y) ?? NaN, 5);
    }
  });

  it("reads flat immediately beside the run's own width, not ramped", () => {
    const view = twoWideSouthEntry();
    expect(stairRampAt(view, 9.5, 10.5)).toBeNull();
    expect(stairRampAt(view, 12.5, 10.5)).toBeNull();
  });

  it("stepping sideways off the ramp onto the flanking approach never leaves the ground", () => {
    const view = twoWideSouthEntry();
    const groundAt = (x: number, y: number): number => stairRampAt(view, x, y) ?? view.heightAt(Math.floor(x), Math.floor(y));
    const stairHeightAt = (x: number, y: number): number | null =>
      view.tileAt(Math.floor(x), Math.floor(y)) === TILE.Stairs ? stairRampAt(view, x, y) : null;
    const world = { isWalkable: () => true, heightAt: view.heightAt, groundAt, stairHeightAt };
    const body = createBody(9.5, 10.9, groundAt(9.5, 10.9));
    let flicker = 0;
    for (let i = 0; i < 40; i++) {
      stepBody(world, body, { moveX: 1, moveY: 0, jump: false }, TICK_DT);
      if (!body.grounded) flicker++;
    }
    expect(flicker).toBe(0);
  });
});
