import { TILE, type TileType } from "@dc2d/engine";
import { isChasmDepth } from "./heightShade.js";

/** A walkable stair cap anchors to its upper whole-height landing instead of splitting between rows. */
export function renderedSurfaceHeight(tile: TileType, physicalHeight: number): number {
  if (tile !== TILE.Stairs) return physicalHeight;
  const aligned = Math.ceil(physicalHeight);
  return Object.is(aligned, -0) ? 0 : aligned;
}

/** Stairs are walkable ground, never purple void volume even when their physical midpoint is below zero. */
export function drawsVoidUnderlay(tile: TileType, height: number): boolean {
  return tile !== TILE.Stairs && height < 0;
}

export function underlaySurface(
  tile: TileType,
  height: number,
): "floor" | "void" | null {
  if (!drawsVoidUnderlay(tile, height)) return null;
  return isChasmDepth(height) ? "void" : "floor";
}
