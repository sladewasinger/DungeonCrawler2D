// Cross-district corridor connectivity is the networking invariant that
// matters most for the shared 96×96 plans.
import { describe, expect, it } from "vitest";
import { hashString } from "../../../core/rng.js";
import {
  districtEdgeAnchors,
  type EdgeAnchor,
} from "../layout/districtEdges.js";
import { DISTRICT_TILE_SPAN } from "../layout/district.js";
import { layoutSeed } from "../layout/hash.js";
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
      for (const anchor of districtEdgeAnchors({
        seed: layoutSeed(seed, FLOOR),
        dx: 0,
        dy: 0,
        districtSize: DISTRICT_TILE_SPAN,
      })) {
        const start = runtimeAnchor(anchor);
        expect(reachesNeighborChunk(scope, start), `seed ${seed}: ${anchorName(anchor)} anchor is isolated`).toBe(true);
      }
    }
  });

  it("keeps the widened district seam connected", () => {
    const seed = SEEDS[0] as number;
    const cache: ChunkCache = new Map();
    const scope = { seed, floor: FLOOR, cache };
    const eastAnchor = districtEdgeAnchors({
      seed: layoutSeed(seed, FLOOR),
      dx: 0,
      dy: 0,
      districtSize: DISTRICT_TILE_SPAN,
    })
      .find((anchor) => anchor.side === 1);
    expect(eastAnchor).toBeDefined();
    if (!eastAnchor) return;
    expect(eastAnchor.width).toBeGreaterThan(3);
    expect(reachesNeighborChunk(scope, runtimeAnchor(eastAnchor))).toBe(true);
  });
});

function runtimeAnchor(anchor: EdgeAnchor): WorldPoint {
  return {
    x: anchor.point.x,
    y: anchor.point.y,
  };
}

function anchorName(anchor: EdgeAnchor): string {
  return ["north", "east", "south", "west"][anchor.side] ?? "unknown";
}
