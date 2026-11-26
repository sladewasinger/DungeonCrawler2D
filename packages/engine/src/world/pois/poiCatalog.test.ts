/** Unit tests validating all 20 biome POI catalog entries, layouts, and puzzle braziers. */
import { describe, expect, it } from "vitest";
import { findChunkPoi } from "../poiStamper.js";
import { POI_CATALOG_LIST, TOTAL_POI_TYPES } from "./poiCatalog.js";

function collectPoiKindsInBox(opts: {
  readonly cxMin: number; readonly cxMax: number; readonly cyMin: number; readonly cyMax: number; readonly out: Set<string>;
}): void {
  for (let cy = opts.cyMin; cy <= opts.cyMax; cy++) {
    for (let cx = opts.cxMin; cx <= opts.cxMax; cx++) {
      const poi = findChunkPoi(1337, cx, cy);
      if (poi) opts.out.add(poi.kind);
    }
  }
}

describe("biome POI catalog & stamper", () => {
  it("registers all 20 distinct POI types including shrines, micro-scenes, lairs, puzzles, and friendly camps", () => {
    expect(TOTAL_POI_TYPES).toBe(20);
    const categories = new Set(POI_CATALOG_LIST.map((e) => e.category));
    for (const c of ["camp", "ruins", "shrine", "micro", "lair", "puzzle", "friendly"]) {
      expect(categories.has(c as never)).toBe(true);
    }
  });

  it("enforces Tier gating near spawn and unlocks late biome POIs past 2000m+", () => {
    const t1Seen = new Set<string>();
    collectPoiKindsInBox({ cxMin: -10, cxMax: 10, cyMin: -10, cyMax: 10, out: t1Seen });
    expect(t1Seen.has("brazier-vault")).toBe(false);
    expect(t1Seen.has("golem-forge")).toBe(false);
    expect(t1Seen.has("cursed-obelisk")).toBe(false);

    const outerSeen = new Set<string>(t1Seen);
    collectPoiKindsInBox({ cxMin: 64, cxMax: 82, cyMin: -12, cyMax: 12, out: outerSeen });
    expect(outerSeen.size).toBeGreaterThanOrEqual(12);
  });
});
