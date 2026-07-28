// Cross-chunk corridor connectivity is the networking invariant that
// matters most for this generator's edge-anchor routing (see edges.ts),
// now also carrying avenue-widened seams at district boundaries.
import { describe, expect, it } from "vitest";
import { hashString } from "../../../core/rng.js";
import { GENERATION_CHUNK_SIZE, WORLD_GEOMETRY_SCALE } from "../layout/scale.js";
import { edgeAnchors, type EdgeAnchor } from "../layout/edges.js";
import { reachesNeighborChunk, type ChunkCache, type WorldPoint } from "../test-support.js";

const FLOOR = 1;
const SEEDS = [
  hashString("layout-test-world"),
  hashString("s2"),
  hashString("s3"),
  hashString("s4"),
  hashString("s5"),
];
describe("cross-chunk connectivity", () => {
  it("holds at all four seams of the origin chunk, for 5 seeds", () => {
    for (const seed of SEEDS) {
      const cache: ChunkCache = new Map();
      const scope = { seed, floor: FLOOR, cache };
      for (const anchor of edgeAnchors({ seed, cx: 0, cy: 0, chunkSize: GENERATION_CHUNK_SIZE })) {
        const start = scaledAnchor(anchor);
        expect(reachesNeighborChunk(scope, start), `seed ${seed}: ${anchorName(anchor)} anchor is isolated`).toBe(true);
      }
    }
  });

  it("keeps the widened avenue seam connected", () => {
    const seed = SEEDS[0] as number;
    const cache: ChunkCache = new Map();
    const scope = { seed, floor: FLOOR, cache };
    const eastAnchor = edgeAnchors({ seed, cx: 2, cy: 0, chunkSize: GENERATION_CHUNK_SIZE })
      .find((anchor) => anchor.side === 1);
    expect(eastAnchor).toBeDefined();
    if (!eastAnchor) return;
    expect(eastAnchor.width).toBeGreaterThan(3);
    expect(reachesNeighborChunk(scope, scaledAnchor(eastAnchor))).toBe(true);
  });
});

function scaledAnchor(anchor: EdgeAnchor): WorldPoint {
  return {
    x: anchor.point.x * WORLD_GEOMETRY_SCALE,
    y: anchor.point.y * WORLD_GEOMETRY_SCALE,
  };
}

function anchorName(anchor: EdgeAnchor): string {
  return ["north", "east", "south", "west"][anchor.side] ?? "unknown";
}
