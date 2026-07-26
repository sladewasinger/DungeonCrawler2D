import { CHUNK_SIZE } from "@dc2d/engine";
import { SCREEN_TILE_PX, SOURCE_TILE_PX } from "../../boot/assetManifest.js";

export const TERRAIN_BAKE_TILE_PX = SOURCE_TILE_PX;
export const TERRAIN_DISPLAY_SCALE = SCREEN_TILE_PX / TERRAIN_BAKE_TILE_PX;
export const TERRAIN_BAKE_CHUNK_PX = CHUNK_SIZE * TERRAIN_BAKE_TILE_PX;
export const TERRAIN_DISPLAY_CHUNK_PX = CHUNK_SIZE * SCREEN_TILE_PX;
export const TERRAIN_RGBA_BYTES_PER_PIXEL = 4;
export const MAX_TERRAIN_TEXTURE_DIMENSION_PX = TERRAIN_BAKE_CHUNK_PX;

export function terrainPageBytes(width: number, height: number): number {
  return width * height * TERRAIN_RGBA_BYTES_PER_PIXEL;
}

export function terrainBakePxToDisplay(bakePx: number): number {
  return bakePx * TERRAIN_DISPLAY_SCALE;
}

export function assertTerrainTextureDimensions(width: number, height: number): void {
  if (width > MAX_TERRAIN_TEXTURE_DIMENSION_PX || height > MAX_TERRAIN_TEXTURE_DIMENSION_PX) {
    throw new Error(`terrain texture ${width}x${height} exceeds ${MAX_TERRAIN_TEXTURE_DIMENSION_PX}px guard`);
  }
}
