// Multi-seed invariants for the StairwayUp/StairwayDown landmark (Epic
// 7.14, docs/ASSUMPTIONS.md #12x): the structure's platform is actually
// reachable from the wider corridor network (feature-link.ts's connector,
// wired in generate/index.ts's stampDescentFeature), same BFS methodology
// safeRoomLink.test.ts already established for the safe-room kiosk.
import { describe, expect, it } from "vitest";
import { stairwayDownChunk, stairwayDownPosition, stairwayUpChunk, stairwayUpPosition } from "../features/descent.js";
import { CHUNK_SIZE, TILE } from "../types.js";
import { generateChunk } from "./index.js";
import { bfsChunks, keyInChunk, type ChunkCache, type WorldPoint } from "./test-support.js";

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 13);

function tileAt(seed: number, floor: number, p: WorldPoint): number {
  const cx = Math.floor(p.x / CHUNK_SIZE);
  const cy = Math.floor(p.y / CHUNK_SIZE);
  const chunk = generateChunk(seed, floor, cx, cy);
  const i = (p.y - cy * CHUNK_SIZE) * CHUNK_SIZE + (p.x - cx * CHUNK_SIZE);
  return chunk.tiles[i] ?? TILE.Wall;
}

describe("StairwayDown/StairwayUp reachability", () => {
  it("StairwayDown's own position is real walkable Floor, on floors 1..FLOOR_CAP-1", { timeout: 120_000 }, () => {
    let checked = 0;
    for (const seed of SEEDS) {
      for (let floor = 1; floor <= 3; floor++) {
        const pos = stairwayDownPosition({ worldSeed: seed, floor });
        expect(pos).not.toBeNull();
        if (!pos) continue;
        expect(tileAt(seed, floor, pos), `seed ${seed} floor ${floor}`).toBe(TILE.Floor);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(50);
  });

  it("StairwayDown's platform reaches the wider corridor network (leaves its own chunk via BFS)", { timeout: 120_000 }, () => {
    let checked = 0;
    for (const seed of SEEDS.slice(0, 35)) {
      const floor = 1;
      const chunk = stairwayDownChunk(seed, floor);
      const pos = stairwayDownPosition({ worldSeed: seed, floor });
      expect(chunk).not.toBeNull();
      expect(pos).not.toBeNull();
      if (!chunk || !pos) continue;
      const cache: ChunkCache = new Map();
      const reached = bfsChunks(seed, floor, pos, 3, cache);
      const touchesNeighbor = Array.from(reached).some((key) => !keyInChunk(key, chunk.cx, chunk.cy));
      expect(touchesNeighbor, `seed ${seed}: StairwayDown pad never leaves its own chunk`).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(25);
  });

  it("StairwayUp's platform likewise reaches the wider corridor network", { timeout: 120_000 }, () => {
    let checked = 0;
    for (const seed of SEEDS.slice(0, 35)) {
      const floor = 2;
      const chunk = stairwayUpChunk(seed, floor);
      const pos = stairwayUpPosition({ worldSeed: seed, floor });
      expect(chunk).not.toBeNull();
      expect(pos).not.toBeNull();
      if (!chunk || !pos) continue;
      const cache: ChunkCache = new Map();
      const reached = bfsChunks(seed, floor, pos, 3, cache);
      const touchesNeighbor = Array.from(reached).some((key) => !keyInChunk(key, chunk.cx, chunk.cy));
      expect(touchesNeighbor, `seed ${seed}: StairwayUp pad never leaves its own chunk`).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(25);
  });
});
