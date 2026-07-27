import { describe, expect, it } from "vitest";
import { BIOME } from "@dc2d/engine";
import {
  TERRAIN4_ATLAS_COLUMNS,
  TERRAIN4_ATLAS_ROWS_PER_SET,
  TERRAIN4_TILE_ROLES,
  TERRAIN4_TILESETS,
  TERRAIN4_CLIFF_ROLES,
  TERRAIN4_CLIFF_TILESETS,
  terrain4CliffAtlasFrame,
  terrain4FrameFor,
} from "./terrain4Tileset.js";

describe("Terrain4 atlas contract", () => {
  it("keeps one stable eight-role layout for debug and every biome", () => {
    expect(TERRAIN4_ATLAS_COLUMNS).toBe(8);
    expect(TERRAIN4_TILE_ROLES).toHaveLength(8);
    expect(TERRAIN4_ATLAS_ROWS_PER_SET).toBe(2);
    for (const biome of Object.values(BIOME)) {
      expect(TERRAIN4_TILESETS[biome].rowCount).toBe(TERRAIN4_ATLAS_ROWS_PER_SET);
    }
  });

  it("assigns both variant rows without changing role columns", () => {
    expect(terrain4FrameFor("floor", 0)).toBe(0);
    expect(terrain4FrameFor("void", 0)).toBe(4);
    expect(terrain4FrameFor("brazier", 1)).toBe(15);
    expect(terrain4FrameFor(TERRAIN4_TILESETS[BIOME.Pools], "floor", 0)).toBe(56);
  });

  it("keeps cliff middle/corner roles in a two-column biome sheet", () => {
    expect(TERRAIN4_CLIFF_ROLES).toEqual(["cliff-middle", "cliff-corner"]);
    expect(TERRAIN4_CLIFF_TILESETS[BIOME.Arena].rowStart).toBe(12);
    expect(terrain4CliffAtlasFrame(TERRAIN4_CLIFF_TILESETS[BIOME.Maze], "cliff-corner", 1, 1060, 1484)).toMatchObject({
      x: 530, y: 318, width: 530, height: 106,
    });
  });
});
