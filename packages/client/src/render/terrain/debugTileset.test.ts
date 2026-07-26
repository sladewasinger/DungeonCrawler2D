import { describe, expect, it } from "vitest";
import { DEBUG_TILE_PX, DEBUG_TILESET_FRAME_COUNT, DEBUG_WALL_BORDER_PX } from "./debugTileset.js";
import { TERRAIN_BAKE_TILE_PX } from "./terrainMetrics.js";

describe("debug terrain source art", () => {
  it("is authored directly at the terrain bake resolution", () => {
    expect(DEBUG_TILE_PX).toBe(16);
    expect(DEBUG_TILE_PX).toBe(TERRAIN_BAKE_TILE_PX);
    expect(DEBUG_WALL_BORDER_PX).toBe(1);
    expect(DEBUG_TILESET_FRAME_COUNT).toBe(20);
  });
});
