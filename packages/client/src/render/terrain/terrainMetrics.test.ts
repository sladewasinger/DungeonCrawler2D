import { describe, expect, it } from "vitest";
import {
  TERRAIN_BAKE_CHUNK_PX,
  TERRAIN_BAKE_TILE_PX,
  TERRAIN_DISPLAY_CHUNK_PX,
  TERRAIN_DISPLAY_SCALE,
  assertTerrainTextureDimensions,
  terrainBakePxToDisplay,
  terrainPageBytes,
} from "./terrainMetrics.js";

describe("terrain renderer metrics", () => {
  it("separates native bake pixels from display pixels", () => {
    expect(TERRAIN_BAKE_TILE_PX).toBe(16);
    expect(TERRAIN_DISPLAY_SCALE).toBe(3);
    expect(TERRAIN_BAKE_CHUNK_PX).toBe(1024);
    expect(TERRAIN_DISPLAY_CHUNK_PX).toBe(3072);
  });

  it("estimates a native whole-chunk page as four raw MiB", () => {
    expect(terrainPageBytes(TERRAIN_BAKE_CHUNK_PX, TERRAIN_BAKE_CHUNK_PX)).toBe(4 * 1024 * 1024);
  });

  it("maps positive and negative bake positions into display space exactly once", () => {
    expect(terrainBakePxToDisplay(17)).toBe(51);
    expect(terrainBakePxToDisplay(-17)).toBe(-51);
  });

  it("rejects a terrain texture larger than a native chunk page", () => {
    expect(() => assertTerrainTextureDimensions(1024, 1024)).not.toThrow();
    expect(() => assertTerrainTextureDimensions(1025, 16)).toThrow(/exceeds 1024px guard/);
  });
});
