import { TILE, type TileType } from "@dc2d/engine";

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
