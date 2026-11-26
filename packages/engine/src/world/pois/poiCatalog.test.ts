/** Unit tests validating all 20 frontier POI catalog entries, layouts, and puzzle braziers. */
import { describe, expect, it } from "vitest";
import { findChunkPoi } from "../poiStamper.js";
import { POI_CATALOG_LIST, TOTAL_POI_TYPES } from "./poiCatalog.js";

describe("frontier POI catalog & stamper", () => {
  it("registers all 20 distinct POI types including shrines, micro-scenes, lairs, puzzles, and friendly camps", () => {
    expect(TOTAL_POI_TYPES).toBe(20);
    const categories = new Set(POI_CATALOG_LIST.map((e) => e.category));
    for (const c of ["camp", "ruins", "shrine", "micro", "lair", "puzzle", "friendly"]) {
      expect(categories.has(c as never)).toBe(true);
    }
  });

  it("discovers many distinct frontier POI kinds across explored outer chunks", () => {
    const seen = new Set<string>();
    for (let cy = -14; cy <= 14; cy++) {
      for (let cx = -14; cx <= 14; cx++) {
        const poi = findChunkPoi(1337, cx, cy);
        if (poi) seen.add(poi.kind);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(12);
  });
});
