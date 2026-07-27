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
import { WORLD_GEOMETRY_SCALE } from "./scale.js";
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
      const stairs = scanStairs({ seed, floor: FLOOR, chunkRange: CHUNK_RANGE });
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
function runFootprint(input: { readonly world: World; readonly point: { readonly x: number; readonly y: number }; readonly dir: number }): StairRun {
  const direction = CLIMB_DIRS[input.dir] as [number, number];
  const top = stairEnd({ world: input.world, start: input.point, direction, sign: 1 });
  const bottom = stairEnd({ world: input.world, start: input.point, direction, sign: -1 });
  return runMetrics({ world: input.world, top, bottom, direction });
}

interface StairRun { readonly length: number; readonly hi: number; readonly lo: number; }
function stairEnd(input: { readonly world: World; readonly start: { readonly x: number; readonly y: number }; readonly direction: [number, number]; readonly sign: number }): { x: number; y: number } {
  const delta = { x: input.direction[0] * input.sign, y: input.direction[1] * input.sign };
  const end = { ...input.start };
  while (input.world.tileAt(end.x + delta.x, end.y + delta.y) === TILE.Stairs) { end.x += delta.x; end.y += delta.y; }
  return end;
}
function runMetrics(input: { readonly world: World; readonly top: { readonly x: number; readonly y: number }; readonly bottom: { readonly x: number; readonly y: number }; readonly direction: [number, number] }): StairRun {
  const [dx, dy] = input.direction;
  const length = (input.top.x - input.bottom.x) * dx + (input.top.y - input.bottom.y) * dy + 1;
  return { length, hi: input.world.heightAt(input.top.x + dx, input.top.y + dy), lo: input.world.heightAt(input.bottom.x - dx, input.bottom.y - dy) };
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
    const MAX_CLUSTER = 16 * WORLD_GEOMETRY_SCALE ** 2;
    for (const seed of SEEDS) {
      for (const cluster of stairClusters(scanStairs({ seed, floor: FLOOR, chunkRange: CHUNK_RANGE }))) {
        expect(cluster.size, `seed ${seed}: cluster at ${cluster.key} has ${cluster.size} tiles`).toBeLessThanOrEqual(MAX_CLUSTER);
      }
    }
  });

  it("a pit/dais exit's own stair footprint stays at exactly |depth| treads (catches a regression widening it back into a runway)", () => {
    for (const seed of SEEDS) assertCompactPitRuns(seed);
  });
});

describe("a room's height-variant floor is reachable via its single staircase", () => {
  it("finds at least one non-flat (deliberate height) floor tile reachable by the STEP_UP walk rule from a corridor", () => {
    for (const seed of SEEDS) {
      const cache: ChunkCache = new Map();
      const scope = { seed, floor: FLOOR, cache };
      const start = anyFloorTile(scope, { cx: 0, cy: 0 });
      expect(start, `seed ${seed}: origin chunk has no floor`).not.toBeNull();
      if (!start) continue;
      const reached = bfsChunks(scope, start, 3);
      const world = new World(seed, FLOOR);
      const sawDeliberateHeight = Array.from(reached).some((key) => isDeliberateFloor(world, key));
      expect(sawDeliberateHeight, `seed ${seed}: no deliberate-height floor reached via the walk rule`).toBe(true);
    }
  });
});

interface StairCluster { readonly key: string; readonly size: number; }
function stairClusters(points: ReadonlyArray<{ readonly x: number; readonly y: number }>): StairCluster[] {
  const stairs = new Set(points.map(pointKey));
  const visited = new Set<string>();
  return Array.from(stairs).flatMap((key) => visited.has(key) ? [] : [measureCluster({ key, stairs, visited })]);
}
function measureCluster(input: { readonly key: string; readonly stairs: Set<string>; readonly visited: Set<string> }): StairCluster {
  const queue = [pointFromKey(input.key)];
  input.visited.add(input.key);
  for (let head = 0; head < queue.length; head++) {
    const point = queue[head];
    if (point) addStairNeighbors({ point, queue, ...input });
  }
  return { key: input.key, size: queue.length };
}
function addStairNeighbors(input: { readonly point: { readonly x: number; readonly y: number }; readonly queue: Array<{ x: number; y: number }>; readonly stairs: Set<string>; readonly visited: Set<string> }): void {
  for (const [x, y] of CARDINAL_DIRECTIONS) addStairNeighbor({ ...input, candidate: { x: input.point.x + x, y: input.point.y + y } });
}
function addStairNeighbor(input: { readonly candidate: { x: number; y: number }; readonly queue: Array<{ x: number; y: number }>; readonly stairs: Set<string>; readonly visited: Set<string> }): void {
  const key = pointKey(input.candidate);
  if (!input.stairs.has(key) || input.visited.has(key)) return;
  input.visited.add(key);
  input.queue.push(input.candidate);
}
function assertCompactPitRuns(seed: number): void {
  const world = new World(seed, FLOOR);
  for (const point of scanStairs({ seed, floor: FLOOR, chunkRange: CHUNK_RANGE })) assertCompactPitRun({ seed, world, point });
}
function assertCompactPitRun(input: { readonly seed: number; readonly world: World; readonly point: { readonly x: number; readonly y: number } }): void {
  const dir = entryClimbDir(input.world, input.point.x, input.point.y);
  if (dir === null) return;
  const run = runFootprint({ world: input.world, point: input.point, dir });
  if (!isPitDaisSpan(run)) return;
  expect(run.length, pitRunMessage(input, run)).toBe(WORLD_GEOMETRY_SCALE);
}
function isPitDaisSpan(run: StairRun): boolean { const span = Math.abs(run.hi - run.lo); return span > 0.9 && span < 1.1; }
function pitRunMessage(input: { readonly seed: number; readonly point: { readonly x: number; readonly y: number } }, run: StairRun): string { return `seed ${input.seed}: pit/dais exit run at (${input.point.x},${input.point.y}) spans ${Math.abs(run.hi - run.lo)} z but is ${run.length} tiles long — a compact 1-z exit must be exactly 1 tile`; }
function isDeliberateFloor(world: World, key: string): boolean { const point = pointFromKey(key); return world.tileAt(point.x, point.y) === TILE.Floor && Math.abs(world.heightAt(point.x, point.y)) > STEP_UP; }
function pointKey(point: { readonly x: number; readonly y: number }): string { return `${point.x},${point.y}`; }
function pointFromKey(key: string): { x: number; y: number } { const [x, y] = key.split(",").map(Number); return { x: x ?? 0, y: y ?? 0 }; }
const CARDINAL_DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
