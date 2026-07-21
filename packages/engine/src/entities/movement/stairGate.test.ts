import { describe, expect, it } from "vitest";
import { MOVE_SPEED, RUN_SPEED_MULTIPLIER, STEP_UP, TICK_DT } from "../../core/constants.js";
import { stairRampAt, type StairView } from "../../world/stairs.js";
import { TILE, type WorldView } from "../../world/types.js";
import { createBody, stepBody } from "./index.js";
import type { BodyState } from "./state.js";
import { stairGateBlocks } from "./stairGate.js";

/**
 * Boundary rim-gate + on-stair glide (docs/R2-STAIRS-SPEC.md sections 3c/3d),
 * exercised at all 4 climb directions via one rotated fixture: a single
 * compact stair tile at (X, Y), high (+dir) neighbor at height 1, low
 * (-dir) neighbor at height 0, perpendicular flank tiles flat at height 0
 * on both sides of the run's own width (matching the low anchor).
 */

const X = 100;
const Y = 100;
/** DIRS convention shared with world/stairs.ts: 0=N, 1=E, 2=S, 3=W. */
const DIR_STEP: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
const DIRS: Array<0 | 1 | 2 | 3> = [0, 1, 2, 3];

function oneTileStair(dir: 0 | 1 | 2 | 3): WorldView & StairView {
  const [dx, dy] = DIR_STEP[dir] as [number, number];
  const tileAt = (wx: number, wy: number): number => (wx === X && wy === Y ? TILE.Stairs : TILE.Floor);
  // On the stair's own column (N/S dir) or row (E/W dir): a flat plateau at
  // height 1 all the way up the +dir side and flat at 0 all the way down
  // the -dir side (a real multi-tile approach, not just one anchor cell).
  // Off that column/row (the perpendicular flank): flat at 0 everywhere,
  // so the flank reads as a real cliff near the stair's high edge.
  const onAxis = (wx: number, wy: number): boolean => (dx === 0 ? wx === X : wy === Y);
  const heightAt = (wx: number, wy: number): number => {
    if (wx === X && wy === Y) return 0.5;
    if (!onAxis(wx, wy)) return 0;
    const along = (wx - X) * dx + (wy - Y) * dy;
    return along > 0 ? 1 : 0;
  };
  const view: StairView = { tileAt, heightAt };
  const groundAt = (x: number, y: number): number => stairRampAt(view, x, y) ?? heightAt(Math.floor(x), Math.floor(y));
  const stairHeightAt = (x: number, y: number): number | null =>
    tileAt(Math.floor(x), Math.floor(y)) === TILE.Stairs ? stairRampAt(view, x, y) : null;
  return { tileAt, heightAt, isWalkable: () => true, groundAt, stairHeightAt };
}

/** true iff the climb axis is Y (north/south dir), i.e. the perpendicular (flank) axis is X. */
function perpAxisIsX(dir: 0 | 1 | 2 | 3): boolean {
  const [dx] = DIR_STEP[dir] as [number, number];
  return dx === 0;
}

/** A point on the stair's own climb axis at fraction `t` (0 = low edge, 1 = high edge), perpendicular coordinate fixed at the tile's own center. */
function rowPoint(dir: 0 | 1 | 2 | 3, t: number): { x: number; y: number } {
  const [dx, dy] = DIR_STEP[dir] as [number, number];
  return { x: X + 0.5 + dx * (t - 0.5), y: Y + 0.5 + dy * (t - 0.5) };
}

/** A point at the same row `t`, on the flank side (the tile at perpendicular+1), `off` tiles from the flank/stair boundary (off > 0 = deeper into the flank, off < 0 = just inside the stair). */
function flankPoint(dir: 0 | 1 | 2 | 3, t: number, off: number): { x: number; y: number } {
  const row = rowPoint(dir, t);
  return perpAxisIsX(dir) ? { x: X + 1 + off, y: row.y } : { x: row.x, y: Y + 1 + off };
}

/** Unit move vector from the flank tile toward the stair tile (the negative perpendicular direction). */
function flankMoveVector(dir: 0 | 1 | 2 | 3): [number, number] {
  return perpAxisIsX(dir) ? [-1, 0] : [0, -1];
}

describe("boundary rim-gate sampling at all 4 climb directions", () => {
  for (const dir of DIRS) {
    const [dx, dy] = DIR_STEP[dir] as [number, number];

    it(`dir ${dir}: along-axis travel across the whole run never blocks`, () => {
      const world = oneTileStair(dir);
      for (const t of [0.05, 0.25, 0.5, 0.75, 0.95]) {
        const p = rowPoint(dir, t);
        const body: BodyState = createBody(p.x, p.y, world.groundAt(p.x, p.y));
        const cx = p.x + dx * 0.01;
        const cy = p.y + dy * 0.01;
        expect(stairGateBlocks(world, body, cx, cy, dx, dy), `dir ${dir} t ${t}`).toBe(false);
      }
    });

    it(`dir ${dir}: a flank move into the ramp's near-high-edge row is blocked (a real wall)`, () => {
      const world = oneTileStair(dir);
      const start = flankPoint(dir, 0.95, 0.4);
      const body: BodyState = createBody(start.x, start.y, 0);
      const dest = flankPoint(dir, 0.95, -0.01);
      const [mdx, mdy] = flankMoveVector(dir);
      expect(stairGateBlocks(world, body, dest.x, dest.y, mdx, mdy), `dir ${dir}`).toBe(true);
    });

    it(`dir ${dir}: a flank move into the ramp's near-low-edge row is flush and allowed`, () => {
      const world = oneTileStair(dir);
      const start = flankPoint(dir, 0.05, 0.4);
      const body: BodyState = createBody(start.x, start.y, 0);
      const dest = flankPoint(dir, 0.05, -0.01);
      const [mdx, mdy] = flankMoveVector(dir);
      expect(stairGateBlocks(world, body, dest.x, dest.y, mdx, mdy), `dir ${dir}`).toBe(false);
    });
  }
});

describe("on-stair glide (no airborne tick) at walk and run speed, all 4 climb directions", () => {
  for (const dir of DIRS) {
    it(`dir ${dir}: walking the full run stays grounded every tick, both speeds`, () => {
      const world = oneTileStair(dir);
      const [dx, dy] = DIR_STEP[dir] as [number, number];
      for (const speed of [MOVE_SPEED, MOVE_SPEED * RUN_SPEED_MULTIPLIER]) {
        const start = { x: X + 0.5 - dx * 2.5, y: Y + 0.5 - dy * 2.5 };
        const body = createBody(start.x, start.y, 0);
        for (let i = 0; i < 60; i++) {
          stepBody(world, body, { moveX: dx, moveY: dy, jump: false }, TICK_DT, { speed });
          expect(body.grounded, `dir ${dir} speed ${speed} tick ${i}`).toBe(true);
        }
        expect(body.z).toBeCloseTo(1, 3);
      }
    });
  }
});

describe("walking off a partially-climbed ramp's side takes a real fall", () => {
  for (const dir of DIRS) {
    it(`dir ${dir}: glide does not suppress fall damage measurement on a side exit`, () => {
      const world = oneTileStair(dir);
      const [dx, dy] = DIR_STEP[dir] as [number, number];
      const [px, py] = flankMoveVector(dir).map((v) => -v) as [number, number];
      const start = { x: X + 0.5 - dx * 2.5, y: Y + 0.5 - dy * 2.5 };
      const body = createBody(start.x, start.y, 0);
      for (let i = 0; i < 60 && body.z < 0.5; i++) {
        stepBody(world, body, { moveX: dx, moveY: dy, jump: false }, TICK_DT);
      }
      expect(body.z).toBeGreaterThan(STEP_UP);
      let fellHeight: number | null = null;
      for (let i = 0; i < 60 && fellHeight === null; i++) {
        const r = stepBody(world, body, { moveX: px, moveY: py, jump: false }, TICK_DT);
        if (r.landed) fellHeight = r.landed.fallHeight;
      }
      expect(fellHeight, `dir ${dir} never landed after stepping off the ramp's side`).not.toBeNull();
      expect(fellHeight as number).toBeGreaterThan(0);
      expect(body.z).toBeCloseTo(0, 3);
    });
  }
});
