/** Property-based multi-seed worldgen invariants: valid spawn ground and PropKind bounds. */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { PROP_SPECS } from "@dc2d/content";
import { GROUND_KIND_VALUES, GroundKind, PROP_KIND_VALUES } from "@dc2d/contracts";
import { WorldChunkCache } from "@dc2d/engine";

const validGrounds = new Set<number>(GROUND_KIND_VALUES);
const validProps = new Set<string>(PROP_KIND_VALUES);

describe("worldgen multi-seed properties", () => {
  it("generates valid tiles, valid PropKinds, and reachable walkable spawn ground across seeds", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100_000 }), (seed) => {
        const cache = new WorldChunkCache(seed);
        const chunk = cache.getChunk(0, 0);
        for (const g of chunk.ground) expect(validGrounds.has(g)).toBe(true);
        for (const prop of chunk.props) {
          expect(validProps.has(prop.kind)).toBe(true);
          expect(PROP_SPECS[prop.kind]).toBeDefined();
          expect(Number.isFinite(prop.x) && Number.isFinite(prop.y)).toBe(true);
        }
        const spawn = cache.tileAt(0, 0);
        expect(spawn.ground).not.toBe(GroundKind.DeepWater);
        expect(spawn.elevation).toBe(0);
      }),
      { numRuns: 25, seed: 20261126 },
    );
  });
});
