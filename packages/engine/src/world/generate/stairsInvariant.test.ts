// Generator invariant: every TILE.Stairs tile is a real, climbable ramp
// step, never a flavor-only label (docs/PORT_PLAN.md's worldgen redesign
// brief, "flavor without height"). Also asserts the redesign's "one
// straight run per transition, no clusters" shape, and that a room's
// height-variant floor stays reachable through its single staircase.
// Escapability (walking a pit's ramp back OUT) and the CHASM_DEATH_Z
// generator invariant live in stairsEscapability.test.ts — split out to
// stay under this repo's per-file line budget.

import { describe, expect, it } from "vitest";
import { hashString } from "../../core/rng.js";
import { STEP_UP } from "../../core/constants.js";
import { entryClimbDir } from "../stairs.js";
import { TILE } from "../types.js";
import { World } from "../world.js";
import { anyFloorTile, bfsChunks, CLIMB_DIRS, scanStairs, type ChunkCache } from "./test-support.js";

export const SEEDS = [
  hashString("dev-world-1"),
  hashString("stairs-invariant-a"),
  hashString("stairs-invariant-b"),
  hashString("stairs-invariant-c"),
  // Regression lock for the CONFIRMED inescapable-pit bug (docs/ROADMAP.md,
  // Epic 7.13): a pit near (37,7) floor 1 had an orphaned partial ramp.
  hashString("austin-dungeon-prod-1"),
];
export const FLOOR = 1;
export const CHUNK_RANGE = 6;

describe("every Stairs tile has a real height delta across its climb axis", () => {
  for (const seed of SEEDS) {
    it(`holds for seed ${seed}`, () => {
      const world = new World(seed, FLOOR);
      const stairs = scanStairs(seed, FLOOR, CHUNK_RANGE);
      expect(stairs.length).toBeGreaterThan(0);
      for (const { x, y } of stairs) {
        expect(entryClimbDir(world, x, y), `stairs tile (${x},${y}) has no valid climb axis`).not.toBeNull();
      }
    });
  }
});

/**
 * Walk a single Stairs tile's OWN straight-line run along its climb axis
 * (fixed perpendicular position, matching stairs.ts's buildRun): how many
 * physical Stairs tiles sit in a row, and what the flanking anchors
 * (`hi`/`lo`, one step past each end) are. Reimplemented locally rather
 * than importing stairs.ts's private buildRun, using only the public
 * World surface — exactly what a "did this one exit widen back into a
 * runway" regression probe should measure directly, independent of the
 * ramp/physics implementation it's guarding.
 */
function runFootprint(world: World, x: number, y: number, dir: number): { length: number; hi: number; lo: number } {
  const [dx, dy] = CLIMB_DIRS[dir] as [number, number];
  let topX = x;
  let topY = y;
  while (world.tileAt(topX + dx, topY + dy) === TILE.Stairs) {
    topX += dx;
    topY += dy;
  }
  let botX = x;
  let botY = y;
  while (world.tileAt(botX - dx, botY - dy) === TILE.Stairs) {
    botX -= dx;
    botY -= dy;
  }
  const length = (topX - botX) * dx + (topY - botY) * dy + 1;
  return { length, hi: world.heightAt(topX + dx, topY + dy), lo: world.heightAt(botX - dx, botY - dy) };
}

describe("stair runs stay short (no clusters / fan fills)", () => {
  it("no connected Stairs region exceeds a small tile budget, across seeds", () => {
    // Post docs/R2-STAIRS-SPEC.md (Wave R2 compact stairs + the sheer-chasm-
    // edge ruling, which drops chasms' descending ramp entirely — see
    // height.ts's applyRoomHeight): the longest DELIBERATE run is a single
    // pit/dais tread (stepCount = round(1) = 1), up to THRESHOLD_RAMP_MAX_WIDTH
    // (2) wide. cliffs.ts's independent graze-repair net can still chain its
    // own short, UNRELATED sub-tier steps (a genuine terrain undulation, not
    // a pit/dais exit) into a nearby cluster via 4-connectivity, so this
    // budget stays generous (empirically observed up to 10 tiles across the
    // scanned seeds) — the tight, exit-specific guarantee is the footprint
    // check below, which is what actually catches a widened runway.
    const MAX_CLUSTER = 16;
    for (const seed of SEEDS) {
      const stairSet = new Set(scanStairs(seed, FLOOR, CHUNK_RANGE).map((t) => `${t.x},${t.y}`));
      const visited = new Set<string>();
      for (const key of stairSet) {
        if (visited.has(key)) continue;
        const [sx, sy] = key.split(",").map(Number) as [number, number];
        const queue = [{ x: sx, y: sy }];
        visited.add(key);
        let size = 0;
        while (queue.length) {
          const cur = queue.pop();
          if (!cur) break;
          size++;
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ] as const) {
            const nk = `${cur.x + dx},${cur.y + dy}`;
            if (stairSet.has(nk) && !visited.has(nk)) {
              visited.add(nk);
              queue.push({ x: cur.x + dx, y: cur.y + dy });
            }
          }
        }
        expect(size, `seed ${seed}: cluster at ${key} has ${size} tiles`).toBeLessThanOrEqual(MAX_CLUSTER);
      }
    }
  });

  it("a pit/dais exit's own stair footprint stays at exactly |depth| treads (catches a regression widening it back into a runway)", () => {
    for (const seed of SEEDS) {
      const world = new World(seed, FLOOR);
      const stairs = scanStairs(seed, FLOOR, CHUNK_RANGE);
      for (const { x, y } of stairs) {
        const dir = entryClimbDir(world, x, y);
        if (dir === null) continue;
        const { length, hi, lo } = runFootprint(world, x, y, dir);
        const span = Math.abs(hi - lo);
        // Only a pit/dais-shaped deliberate exit (~1 z total span across the
        // whole run, ROOM_RISE): a genuine cliffs.ts sub-tier repair chain
        // elsewhere can have any smaller span and is out of scope here.
        if (span <= 0.9 || span >= 1.1) continue;
        expect(
          length,
          `seed ${seed}: pit/dais exit run at (${x},${y}) spans ${span} z but is ${length} tiles long — ` +
            `a compact 1-z exit must be exactly 1 tile`,
        ).toBe(1);
      }
    }
  });
});

describe("a room's height-variant floor is reachable via its single staircase", () => {
  it("finds at least one non-flat (deliberate height) floor tile reachable by the STEP_UP walk rule from a corridor", () => {
    for (const seed of SEEDS) {
      const cache: ChunkCache = new Map();
      const start = anyFloorTile(seed, FLOOR, 0, 0, cache);
      expect(start, `seed ${seed}: origin chunk has no floor`).not.toBeNull();
      if (!start) continue;
      const reached = bfsChunks(seed, FLOOR, start, 3, cache);
      const world = new World(seed, FLOOR);
      let sawDeliberateHeight = false;
      for (const key of reached) {
        const [wx, wy] = key.split(",").map(Number) as [number, number];
        if (world.tileAt(wx, wy) === TILE.Floor && Math.abs(world.heightAt(wx, wy)) > STEP_UP) {
          sawDeliberateHeight = true;
          break;
        }
      }
      expect(sawDeliberateHeight, `seed ${seed}: no deliberate-height floor reached via the walk rule`).toBe(true);
    }
  });
});
