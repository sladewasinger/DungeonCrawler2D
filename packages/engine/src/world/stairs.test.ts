import { describe, expect, it } from "vitest";
import { STEP_UP, TICK_DT } from "../core/constants.js";
import { createBody, stepBody } from "../entities/movement/index.js";
import { entryClimbDir, stairRampAt, type StairView } from "./stairs.js";
import { TILE, type WorldView } from "./types.js";

/**
 * Generator-independent stair fixtures: hand-built WorldView/StairView
 * geometry rather than a scan over any particular chunk generator's
 * output. Which generator is wired in as World's default is free to
 * change (docs/PORT_PLAN.md's worldgen redesign brief) — these physics
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
  return { tileAt, heightAt, isWalkable: () => true, groundAt };
}

describe("stairs as physical ramps", () => {
  const world = southEntryWorld();
  const entry = { x: STAIR_X, y: STAIR_Y };

  it("ramps linearly across the complete two-and-a-half-tile stair run", () => {
    const { x, y } = entry;
    expect(stairRampAt(world, x + 0.5, y + 2.499)).toBeCloseTo(0, 2);
    expect(stairRampAt(world, x + 0.5, y + 2.25)).toBeCloseTo(0.1, 5);
    expect(stairRampAt(world, x + 0.5, y + 2)).toBeCloseTo(0.2, 5);
    expect(stairRampAt(world, x + 0.5, y + 1.5)).toBeCloseTo(0.4, 5);
    expect(stairRampAt(world, x + 0.5, y + 1.25)).toBeCloseTo(0.5, 5);
    expect(stairRampAt(world, x + 0.5, y + 1.001)).toBeCloseTo(0.6, 2);
    expect(stairRampAt(world, x + 0.5, y + 0.999)).toBeCloseTo(0.6, 2);
    expect(stairRampAt(world, x + 0.5, y + 0.75)).toBeCloseTo(0.7, 5);
    expect(stairRampAt(world, x + 0.5, y + 0.5)).toBeCloseTo(0.8, 5);
    expect(stairRampAt(world, x + 0.5, y + 0.25)).toBeCloseTo(0.9, 5);
    expect(stairRampAt(world, x + 0.5, y + 0.001)).toBeCloseTo(1, 2);
    expect(world.groundAt(x + 0.5, y + 3.5)).toBe(0);
    expect(world.groundAt(x + 0.5, y - 0.5)).toBe(1);
  });

  it("starts climbing on the outer approach tile and reaches the top on foot", () => {
    const { x, y } = entry;
    const body = createBody(x + 0.5, y + 3.5, 0);
    const zs: number[] = [];
    let roseOnOuterApproach = false;
    for (let i = 0; i < 30; i++) {
      stepBody(world, body, { moveX: 0, moveY: -1, jump: false }, TICK_DT);
      zs.push(body.z);
      expect(body.grounded).toBe(true);
      if (Math.floor(body.y) === y + 2 && body.z > 0) roseOnOuterApproach = true;
    }
    expect(body.z).toBeCloseTo(1, 5);
    expect(roseOnOuterApproach).toBe(true);
    expect(zs.some((z) => z > 0.1 && z < 0.4)).toBe(true);
    expect(zs.some((z) => z > 0.6 && z < 0.9)).toBe(true);
    for (let i = 1; i < zs.length; i++) {
      const prev = zs[i - 1];
      const cur = zs[i];
      if (prev === undefined || cur === undefined) continue;
      expect(cur - prev).toBeLessThan(STEP_UP * 0.9);
    }
  });

  it("falls from partial height when leaving the stair's side", () => {
    const { x, y } = entry;
    const body = createBody(x + 0.5, y + 3.5, 0);
    for (let i = 0; i < 30 && body.z < 0.2; i++) {
      stepBody(world, body, { moveX: 0, moveY: -1, jump: false }, TICK_DT);
    }
    expect(body.z).toBeGreaterThan(0.1);
    expect(body.z).toBeLessThan(1);
    const sideOpen =
      world.tileAt(x + 1, Math.floor(body.y)) === TILE.Floor &&
      world.heightAt(x + 1, Math.floor(body.y)) < body.z;
    const dir = sideOpen ? 1 : -1;
    let fell: number | null = null;
    for (let i = 0; i < 60 && fell === null; i++) {
      const r = stepBody(world, body, { moveX: dir, moveY: 0, jump: false }, TICK_DT);
      if (r.landed) fell = r.landed.fallHeight;
    }
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
    const world = { isWalkable: () => true, heightAt: view.heightAt, groundAt };
    const body = createBody(9.5, 10.9, groundAt(9.5, 10.9));
    let flicker = 0;
    for (let i = 0; i < 40; i++) {
      stepBody(world, body, { moveX: 1, moveY: 0, jump: false }, TICK_DT);
      if (!body.grounded) flicker++;
    }
    expect(flicker).toBe(0);
  });
});

describe("multi-tile runs (chasm-gradient regression)", () => {
  /**
   * Regression for the pre-deploy "stuck on stairs" bug: entryClimbDir used
   * to require a rise/drop magnitude inside a fixed (0.25, 0.75) band tuned
   * for a single half-height threshold tile. A chasm's multi-tile ramp
   * (CHASM_DEPTH -2 over several tiles, ~0.33-0.5 per step) sits INSIDE that
   * band on magnitude, but every interior tile's neighbor on one side is
   * ANOTHER Stairs tile — the old code excluded any Stairs-tiled neighbor
   * outright, so no interior tile of a multi-tile run ever validated,
   * regardless of magnitude. entryClimbDir must work from neighbor height
   * SIGNS alone, whatever the tile type on either side.
   */
  const RUN_X = 50;
  const RUN_Y = 50;

  /** `width` columns of `steps` Stairs tiles descending from height 0 (north, flat) to `depth` (south, flat), step = depth/(steps+1). */
  function straightRun(steps: number, depth: number, width = 1): StairView {
    const stepHeight = (i: number): number => (depth * i) / (steps + 1);
    const inRun = (wx: number): boolean => wx >= RUN_X && wx < RUN_X + width;
    return {
      tileAt: (wx, wy) => (inRun(wx) && wy >= RUN_Y && wy < RUN_Y + steps ? TILE.Stairs : TILE.Floor),
      heightAt: (wx, wy) => {
        if (!inRun(wx)) return wy < RUN_Y ? 0 : depth;
        if (wy < RUN_Y) return 0;
        if (wy >= RUN_Y + steps) return depth;
        return stepHeight(wy - RUN_Y + 1);
      },
    };
  }

  /** Walk a body straight down `view` from the north flat approach; fails if it ever leaves the ground. */
  function walkDown(view: StairView, startX: number, steps: number, depth: number): void {
    const groundAt = (x: number, y: number): number =>
      stairRampAt(view, x, y) ?? view.heightAt(Math.floor(x), Math.floor(y));
    const world = { isWalkable: () => true, heightAt: view.heightAt, groundAt };
    const body = createBody(startX, RUN_Y - 2, 0);
    for (let i = 0; i < 150; i++) {
      stepBody(world, body, { moveX: 0, moveY: 1, jump: false }, TICK_DT);
      expect(body.grounded, `tick ${i} got stuck airborne`).toBe(true);
    }
    expect(body.z).toBeCloseTo(depth, 1);
    expect(body.y, "must have actually reached the far side").toBeGreaterThan(RUN_Y + steps);
  }

  it("detects a climb direction at every interior tile of a 4-step run, not just the ends", () => {
    const view = straightRun(4, -2);
    for (let step = 0; step < 4; step++) {
      const y = RUN_Y + step;
      expect(entryClimbDir(view, RUN_X, y), `step ${step} (y=${y})`).toBe(0);
    }
  });

  it("ramps continuously and walkably down a run whose per-step magnitude is OUTSIDE the old 0.25-0.75 band", () => {
    // 6 steps over depth -2 -> ~0.286 per step, and 2 steps over -2 -> 0.667
    // per step: both sit outside the old fixed band on either side.
    for (const steps of [2, 6]) walkDown(straightRun(steps, -2), RUN_X + 0.5, steps, -2);
  });

  it("walks a wide (2-tile) multi-step run without a body-radius side clip", () => {
    walkDown(straightRun(3, -2, 2), RUN_X + 1, 3, -2);
  });
});
