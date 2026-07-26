import type { StackDir } from "@dc2d/engine";

export interface StairPlacementPoint {
  readonly x: number;
  readonly y: number;
}

export interface StairPlacementWorld {
  inGrid(x: number, y: number): boolean;
  heightAt(x: number, y: number): number;
}

export interface StairPlacementPlan {
  readonly stair: StairPlacementPoint;
  readonly destination: StairPlacementPoint;
  readonly originLanding: StairPlacementPoint;
  readonly stairDirection: StackDir;
  readonly originHeight: number;
  readonly destinationHeight: number;
}

const DIRECTION_BY_DELTA: ReadonlyMap<string, StackDir> = new Map([
  ["0,-1", 0],
  ["1,0", 1],
  ["0,1", 2],
  ["-1,0", 3],
]);

export function planStairPlacement(
  world: StairPlacementWorld,
  stair: StairPlacementPoint,
  destination: StairPlacementPoint,
): StairPlacementPlan | null {
  const dx = destination.x - stair.x;
  const dy = destination.y - stair.y;
  const clickedDirection = DIRECTION_BY_DELTA.get(`${dx},${dy}`);
  const originLanding = { x: stair.x - dx, y: stair.y - dy };
  if (
    clickedDirection === undefined ||
    !world.inGrid(stair.x, stair.y) ||
    !world.inGrid(destination.x, destination.y) ||
    !world.inGrid(originLanding.x, originLanding.y)
  ) {
    return null;
  }

  const originHeight = world.heightAt(stair.x, stair.y);
  const descendsTowardDestination =
    world.heightAt(destination.x, destination.y) < originHeight;
  return {
    stair,
    destination,
    originLanding,
    stairDirection: descendsTowardDestination
      ? ((clickedDirection + 2) % 4) as StackDir
      : clickedDirection,
    originHeight,
    destinationHeight: originHeight + (descendsTowardDestination ? -1 : 1),
  };
}
