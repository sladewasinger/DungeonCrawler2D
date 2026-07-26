import { stairVisualAt, TILE, type TileType } from "@dc2d/engine";
import { screenClimbDirIndex } from "./stairScreenDirection.js";
import type { ViewTerrainWorld } from "./viewWorld.js";

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

export function northClimbingStairCoversUnderlay(
  world: ViewTerrainWorld,
  wx: number,
  wy: number,
  height: number,
): boolean {
  const stairY = wy - 1;
  const real = world.toReal(wx, stairY);
  const stair = stairVisualAt(world.real, real.x, real.y);
  if (!stair || screenClimbDirIndex(stair.direction, world.orientation) !== 0) return false;
  return world.groundAt(wx + 0.5, stairY + 0.5) > height;
}
