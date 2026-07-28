import { describe, expect, it } from "vitest";
import { BIOME } from "@dc2d/engine";
import {
  TERRAIN4_ATLAS_COLUMNS,
  TERRAIN4_ATLAS_ROWS_PER_SET,
  TERRAIN4_TILE_ROLES,
  TERRAIN4_TILESETS,
  terrain4FrameFor,
} from "./terrain4Tileset.js";

describe("Terrain4 atlas contract", () => {
  it("keeps one stable eight-role layout for debug and every biome", () => {
    expect(TERRAIN4_ATLAS_COLUMNS).toBe(8);
    expect(TERRAIN4_TILE_ROLES).toHaveLength(8);
    expect(TERRAIN4_ATLAS_ROWS_PER_SET).toBe(1);
    for (const biome of Object.values(BIOME)) {
      expect(TERRAIN4_TILESETS[biome].rowCount).toBe(TERRAIN4_ATLAS_ROWS_PER_SET);
      expect(TERRAIN4_TILESETS[biome].key).toBe("terrain4-uniform");
    }
  });

  it("assigns one row without changing role columns", () => {
    expect(terrain4FrameFor("floor", 0)).toBe(0);
    expect(terrain4FrameFor("void", 0)).toBe(4);
    expect(terrain4FrameFor("brazier", 0)).toBe(7);
    expect(terrain4FrameFor(TERRAIN4_TILESETS[BIOME.Pools], "floor", 0)).toBe(0);
    expect(() => terrain4FrameFor("floor", 1)).toThrow("row must be 0");
  });
});
