import { describe, expect, it } from "vitest";
import { BIOME } from "@dc2d/engine";
import {
  TERRAIN4_ATLAS_COLUMNS,
  TERRAIN4_ATLAS_ROWS_PER_SET,
  TERRAIN4_TILE_ROLES,
  TERRAIN4_TILESETS,
  terrain4AtlasFrame,
  terrain4FrameFor,
} from "./terrain4Tileset.js";

describe("Terrain4 atlas contract", () => {
  it("keeps one stable labeled layout for debug and every biome", () => {
    expect(TERRAIN4_ATLAS_COLUMNS).toBe(9);
    expect(TERRAIN4_TILE_ROLES).toHaveLength(8);
    expect(TERRAIN4_ATLAS_ROWS_PER_SET).toBe(5);
    for (const biome of Object.values(BIOME)) {
      expect(TERRAIN4_TILESETS[biome].rowCount).toBe(1);
      expect(TERRAIN4_TILESETS[biome].key).toBe("shared-atlas");
    }
  });

  it("assigns roles to their labeled feature rows", () => {
    expect(terrain4FrameFor("floor", 0)).toBe(1);
    expect(terrain4FrameFor("void", 0)).toBe(37);
    expect(terrain4FrameFor("stair-wall-face", 0)).toBe(20);
    expect(terrain4FrameFor("brazier", 0)).toBe(29);
    expect(terrain4FrameFor(TERRAIN4_TILESETS[BIOME.Pools], "floor", 0)).toBe(1);
    expect(() => terrain4FrameFor("floor", 1)).toThrow("row must be 0");
  });

  it("crops each role from its labeled row", () => {
    expect(terrain4AtlasFrame({
      set: TERRAIN4_TILESETS[BIOME.Maze], role: "stairs", variant: 0, image: { width: 576, height: 320 },
    })).toMatchObject({ x: 64, y: 128, width: 64, height: 64 });
  });
});
