// Generator invariant: every TILE.Stairs tile is a real, climbable ramp
// step, never a flavor-only label (docs/PORT_PLAN.md's worldgen redesign
// brief, "flavor without height"). Also asserts the redesign's "one
// straight run per transition, no clusters" shape, and that a room's
// height-variant floor stays reachable through its single staircase.

import { describe, expect, it } from "vitest";
import { hashString } from "../../core/rng.js";
import { CHASM_DEATH_Z, STEP_UP } from "../../core/constants.js";
import { isSafeRoomChunk, isStairsChunk } from "../features/fixed.js";
import { entryClimbDir } from "../stairs.js";
import { CHUNK_SIZE, TILE } from "../types.js";
import { World } from "../world.js";
import { generateChunk } from "./index.js";
import { anyFloorTile, bfsChunks, type ChunkCache, type WorldPoint } from "./test-support.js";

const SEEDS = [
  hashString("dev-world-1"),
  hashString("stairs-invariant-a"),
  hashString("stairs-invariant-b"),
  hashString("stairs-invariant-c"),
  // Regression lock for the CONFIRMED inescapable-pit bug (docs/ROADMAP.md,
  // Epic 7.13): a pit near (37,7) floor 1 had an orphaned partial ramp.
  hashString("austin-dungeon-prod-1"),
];
const FLOOR = 1;
const CHUNK_RANGE = 6;

function forEachChunkCoord(cb: (cx: number, cy: number) => void): void {
  for (let cx = -CHUNK_RANGE; cx <= CHUNK_RANGE; cx++) {
    for (let cy = -CHUNK_RANGE; cy <= CHUNK_RANGE; cy++) cb(cx, cy);
  }
}

/** Every Stairs tile's world coordinates in the scanned region. */
function scanStairs(seed: number): Array<{ x: number; y: number }> {
  const found: Array<{ x: number; y: number }> = [];
  forEachChunkCoord((cx, cy) => {
    const chunk = generateChunk(seed, FLOOR, cx, cy);
    for (let i = 0; i < chunk.tiles.length; i++) {
      if (chunk.tiles[i] !== TILE.Stairs) continue;
      const lx = i % CHUNK_SIZE;
      const ly = (i - lx) / CHUNK_SIZE;
      found.push({ x: cx * CHUNK_SIZE + lx, y: cy * CHUNK_SIZE + ly });
    }
  });
  return found;
}

describe("every Stairs tile has a real height delta across its climb axis", () => {
  for (const seed of SEEDS) {
    it(`holds for seed ${seed}`, () => {
      const world = new World(seed, FLOOR);
      const stairs = scanStairs(seed);
      expect(stairs.length).toBeGreaterThan(0);
      for (const { x, y } of stairs) {
        expect(entryClimbDir(world, x, y), `stairs tile (${x},${y}) has no valid climb axis`).not.toBeNull();
      }
    });
  }
});

describe("stair runs stay short (no clusters / fan fills)", () => {
  it("no connected Stairs region exceeds a small tile budget, across seeds", () => {
    // A deliberate chasm ramp is the longest authored run: ceil(2/0.5)-1 = 3
    // physical tiles, up to THRESHOLD_RAMP_MAX_WIDTH(2) wide -> budget with
    // slack for the safety-net cliffs.ts adding at most one extra tread.
    const MAX_CLUSTER = 10;
    for (const seed of SEEDS) {
      const stairSet = new Set(scanStairs(seed).map((t) => `${t.x},${t.y}`));
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

/** Any floor at or below this sits in a deliberate sunken (pit) variant, not a small lip. */
const SUNKEN_THRESHOLD = -STEP_UP;

/** stairs.ts's own DIRS convention (0=N,1=E,2=S,3=W); entryClimbDir's returned index points from a Stairs tile toward its strictly-higher neighbor. */
const CLIMB_DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/**
 * The low-side landing of every pit ramp found in the scanned region: for
 * each valid Stairs tile whose climb axis descends into a sunken (pit,
 * not death-zone chasm — see CHASM_DEATH_Z) interior, the interior tile
 * one step past its low end. That's the exact tile a room's own carveRamp
 * (height.ts) guarantees reaches the room's true depth — the natural
 * "did this room's deliberate ramp actually connect?" probe, unlike
 * scanning for the single globally-deepest sunken tile, which can land in
 * an unrelated, doorway-less room this ramp was never meant to serve.
 *
 * Safe-room/stairs chunks are skipped: applyFlattenedFeature (features/
 * fixed.ts) stamps a hand-placed blend over whatever the procedural
 * room/height pass left there, a wholly different authoring contract
 * from a plain room's carveRamp — job #4 (safe-room door geometry) owns
 * that surface, not this pit/chasm generator invariant.
 */
function findPitRampLandings(seed: number, world: World): WorldPoint[] {
  const landings: WorldPoint[] = [];
  const seen = new Set<string>();
  forEachChunkCoord((cx, cy) => {
    if (isSafeRoomChunk(seed, FLOOR, cx, cy) || isStairsChunk(seed, FLOOR, cx, cy)) return;
    const chunk = generateChunk(seed, FLOOR, cx, cy);
    for (let i = 0; i < chunk.tiles.length; i++) {
      if (chunk.tiles[i] !== TILE.Stairs) continue;
      const lx = i % CHUNK_SIZE;
      const ly = (i - lx) / CHUNK_SIZE;
      const wx = cx * CHUNK_SIZE + lx;
      const wy = cy * CHUNK_SIZE + ly;
      const dir = entryClimbDir(world, wx, wy);
      if (dir === null) continue;
      const [dx, dy] = CLIMB_DIRS[dir] as [number, number];
      const landing = { x: wx - dx, y: wy - dy };
      const h = world.heightAt(landing.x, landing.y);
      if (h >= SUNKEN_THRESHOLD || h <= CHASM_DEATH_Z) continue;
      const key = `${landing.x},${landing.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      landings.push(landing);
    }
  });
  return landings;
}

const ESCAPE_STEP = 0.2; // sub-tile resolution: coarse whole-tile hops miss a real single-tile ramp's climb
const ESCAPE_RADIUS = 16; // tiles: a pit's escape route is always local (one room + its doorway)

/**
 * Fine-grained flood-fill from `start` using the REAL continuous ground
 * rule (world.groundAt, rise <= STEP_UP, drops free) at sub-tile
 * resolution: a whole-tile BFS can misjudge a legitimate single-Stairs-
 * tile ramp as "too steep" because it only samples tile centers a full
 * unit apart, wider than the ramp's own virtual padding — see
 * test-support.ts's bfsChunks, which stays whole-tile for its own
 * (cheaper, less precise) connectivity tests.
 */
function canEscapeSunken(world: World, start: WorldPoint, targetHeight: number): boolean {
  const toWorld = (gx: number, gy: number): WorldPoint => ({
    x: start.x + 0.5 + gx * ESCAPE_STEP,
    y: start.y + 0.5 + gy * ESCAPE_STEP,
  });
  const maxG = Math.round(ESCAPE_RADIUS / ESCAPE_STEP);
  const visited = new Set<string>(["0,0"]);
  const queue: Array<[number, number]> = [[0, 0]];
  let head = 0;
  while (head < queue.length) {
    const [gx, gy] = queue[head++] as [number, number];
    const p = toWorld(gx, gy);
    const h = world.groundAt(p.x, p.y);
    if (h >= targetHeight) return true;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const ngx = gx + dx;
      const ngy = gy + dy;
      const key = `${ngx},${ngy}`;
      if (visited.has(key) || Math.abs(ngx) > maxG || Math.abs(ngy) > maxG) continue;
      const np = toWorld(ngx, ngy);
      if (!world.isWalkable(Math.floor(np.x), Math.floor(np.y))) continue;
      if (world.groundAt(np.x, np.y) - h > STEP_UP) continue;
      visited.add(key);
      queue.push([ngx, ngy]);
    }
  }
  return false;
}

// The ascending-only blind spot that shipped the CONFIRMED inescapable-pit
// bug (docs/ROADMAP.md's austin-dungeon-prod-1 (37,7) repro): the tests
// above only prove a deliberate-height floor is reachable WALKING IN from a
// corridor (descending is always free — "drops are free"). A pit's ramp
// must ALSO be walkable back OUT, ascending, which is where a broken/
// orphaned chain (pit depth -> partial ramp -> pit depth again, never
// reaching rim height) actually traps a player.
describe("a pit's deepest floor can walk back OUT (negative-height transitions)", () => {
  for (const seed of SEEDS) {
    it(`holds for seed ${seed}`, () => {
      const world = new World(seed, FLOOR);
      const landings = findPitRampLandings(seed, world);
      expect(landings.length, `seed ${seed}: no pit-ramp landing found in scan range`).toBeGreaterThan(0);
      for (const landing of landings) {
        const escaped = canEscapeSunken(world, landing, SUNKEN_THRESHOLD);
        expect(
          escaped,
          `seed ${seed}: pit floor at (${landing.x},${landing.y}) has no walking exit to level ` +
            `ground — an orphaned/broken ramp chain (docs/ROADMAP.md's inescapable-pit bug)`,
        ).toBe(true);
      }
    });
  }
});
