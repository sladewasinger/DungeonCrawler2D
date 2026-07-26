import { CHUNK_SIZE } from "@dc2d/engine";
import { SCREEN_TILE_PX, SOURCE_TILE_PX } from "../../boot/assetManifest.js";

export const TERRAIN_BAKE_TILE_PX = SOURCE_TILE_PX;
export const TERRAIN_DISPLAY_SCALE = SCREEN_TILE_PX / TERRAIN_BAKE_TILE_PX;
export const TERRAIN_TEXTURE_DIMENSION_CEILING_PX = 1024;
export const TERRAIN_BAKE_CHUNK_PX = terrainBakeChunkPx(CHUNK_SIZE);
export const TERRAIN_DISPLAY_CHUNK_PX = CHUNK_SIZE * SCREEN_TILE_PX;
export const TERRAIN_RGBA_BYTES_PER_PIXEL = 4;

export function terrainBakeChunkPx(chunkSize: number): number {
  return chunkSize * TERRAIN_BAKE_TILE_PX;
}

export function terrainPageBytes(width: number, height: number): number {
  return width * height * TERRAIN_RGBA_BYTES_PER_PIXEL;
}

export function terrainBakePxToDisplay(bakePx: number): number {
  return bakePx * TERRAIN_DISPLAY_SCALE;
}

export function assertTerrainTextureDimensions(
  width: number,
  height: number,
  maximumPreferredPagePx: number,
): void {
  const limit = Math.min(TERRAIN_TEXTURE_DIMENSION_CEILING_PX, maximumPreferredPagePx);
  if (width > limit || height > limit) {
    throw new Error(`terrain texture ${width}x${height} exceeds ${limit}px limit`);
  }
}
