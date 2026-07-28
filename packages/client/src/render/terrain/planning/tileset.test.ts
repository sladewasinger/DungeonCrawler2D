import { describe, expect, it } from "vitest";
import { BIOME } from "@dc2d/engine";
import {
  TERRAIN_ATLAS_COLUMNS,
  TERRAIN_ATLAS_ROWS_PER_SET,
  TERRAIN_TILE_ROLES,
  TERRAIN_TILESETS,
  terrainAtlasFrame,
  terrainFrameFor,
} from "./tileset.js";

describe("Terrain atlas contract", () => {
  it("keeps one stable labeled layout for debug and every biome", () => {
    expect(TERRAIN_ATLAS_COLUMNS).toBe(9);
    expect(TERRAIN_TILE_ROLES).toHaveLength(8);
    expect(TERRAIN_ATLAS_ROWS_PER_SET).toBe(5);
    for (const biome of Object.values(BIOME)) {
      expect(TERRAIN_TILESETS[biome].rowCount).toBe(1);
      expect(TERRAIN_TILESETS[biome].key).toBe("shared-atlas");
    }
  });

  it("assigns roles to their labeled feature rows", () => {
    expect(terrainFrameFor("floor", 0)).toBe(1);
    expect(terrainFrameFor("void", 0)).toBe(37);
    expect(terrainFrameFor("stair-wall-face", 0)).toBe(20);
    expect(terrainFrameFor("brazier", 0)).toBe(29);
    expect(terrainFrameFor(TERRAIN_TILESETS[BIOME.Pools], "floor", 0)).toBe(1);
    expect(() => terrainFrameFor("floor", 1)).toThrow("row must be 0");
  });

  it("crops each role from its labeled row", () => {
    expect(terrainAtlasFrame({
      set: TERRAIN_TILESETS[BIOME.Maze], role: "stairs", variant: 0, image: { width: 576, height: 320 },
    })).toMatchObject({ x: 64, y: 128, width: 64, height: 64 });
  });
});
