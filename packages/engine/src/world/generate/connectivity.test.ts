// Cross-chunk corridor connectivity is the networking invariant that
// matters most for this generator's edge-anchor routing (see edges.ts),
// now also carrying avenue-widened seams at district boundaries.
import { describe, expect, it } from "vitest";
import { hashString } from "../../core/rng.js";
import { anyFloorTile, bfsChunks, keyInChunk, type ChunkCache } from "./test-support.js";

const FLOOR = 1;
const SEEDS = [
  hashString("layout-test-world"),
  hashString("s2"),
  hashString("s3"),
  hashString("s4"),
  hashString("s5"),
];
const SEAMS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

describe("cross-chunk connectivity", () => {
  it("holds at all four seams of the origin chunk, for 5 seeds", () => {
    for (const seed of SEEDS) {
      const cache: ChunkCache = new Map();
      const start = anyFloorTile(seed, FLOOR, 0, 0, cache);
      expect(start, `seed ${seed}: origin chunk has no floor`).not.toBeNull();
      if (!start) continue;
      const reached = bfsChunks(seed, FLOOR, start, 1, cache);
      for (const [cx, cy] of SEAMS) {
        const touchesNeighbor = Array.from(reached).some((key) => keyInChunk(key, cx, cy));
        expect(touchesNeighbor, `seed ${seed}: seam to chunk ${cx},${cy} unreachable`).toBe(true);
      }
    }
  });

  it("holds across a wider region, including super-chunk (district/avenue) seams", () => {
    const seed = SEEDS[0] as number;
    const cache: ChunkCache = new Map();
    const start = anyFloorTile(seed, FLOOR, 0, 0, cache);
    expect(start).not.toBeNull();
    if (!start) return;
    const reached = bfsChunks(seed, FLOOR, start, 4, cache);
    // Chunks (3,0) and (4,0) straddle a super-chunk boundary (SUPERCHUNK_SIZE
    // = 3): an avenue seam. Both sides must be reachable from the origin.
    expect(Array.from(reached).some((key) => keyInChunk(key, 3, 0))).toBe(true);
    expect(Array.from(reached).some((key) => keyInChunk(key, 4, 0))).toBe(true);
  });
});
