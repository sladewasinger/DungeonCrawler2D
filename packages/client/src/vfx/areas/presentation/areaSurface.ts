import { SCREEN_TILE_PX } from "../../../boot/assetManifest.js";
import { groundToScreen } from "../../../render/entities/geometry/worldToScreen.js";
import type { AreaTileView } from "../areaEffectPool.js";

/** Terrain heights are integer tiles except on stairs; this absorbs float noise only. */
export const AREA_SURFACE_HEIGHT_TOLERANCE = 0.01;

export function sameAreaSurfaceHeight(
  left: number,
  right: number,
): boolean {
  return Math.abs(left - right) <= AREA_SURFACE_HEIGHT_TOLERANCE;
}

export function areaSurfaceScreen(
  tile: AreaTileView,
): Readonly<{ x: number; y: number }> {
  return { x: tile.screenX, y: tile.screenY };
}

export function areaSurfaceRow(tile: AreaTileView): number {
  return Math.floor(tile.screenY / SCREEN_TILE_PX);
}

/**
 * Connected neighbors share a surface height, so this is the canonical position
 * for their projected edge without re-sampling the world in a renderer.
 */
export function projectAreaSurfaceNeighbor(
  tile: AreaTileView,
  x: number,
  y: number,
): { x: number; y: number } {
  return groundToScreen(x, y, tile.groundHeight);
}
