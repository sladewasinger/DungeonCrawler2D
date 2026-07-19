// Generator invariant: every TILE.Stairs tile is a real, climbable ramp
// step, never a flavor-only label (docs/PORT_PLAN.md's worldgen redesign
// brief, "flavor without height"). Also asserts the redesign's "one
// straight run per transition, no clusters" shape, and that a room's
// height-variant floor stays reachable through its single staircase.

import { describe, expect, it } from "vitest";
import { hashString } from "../../core/rng.js";
import { STEP_UP } from "../../core/constants.js";
import { entryClimbDir } from "../stairs.js";
import { CHUNK_SIZE, TILE } from "../types.js";
import { World } from "../world.js";
import { generateChunk } from "./index.js";
import { anyFloorTile, bfsChunks, type ChunkCache } from "./test-support.js";

const SEEDS = [
  hashString("dev-world-1"),
  hashString("stairs-invariant-a"),
  hashString("stairs-invariant-b"),
  hashString("stairs-invariant-c"),
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
