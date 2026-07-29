import type { WorldView } from "../core/types.js";
import {
  advanceSightElevation,
  SIGHT_HEIGHT_EPSILON,
  type SightElevation,
} from "./terrainSightElevation.js";

const CORNER_EPSILON = 1e-9;

export interface SightPoint {
  readonly x: number;
  readonly y: number;
}

export interface TerrainSight {
  readonly world: WorldView;
  readonly from: SightPoint;
  readonly to: SightPoint;
  readonly maximumHeightDifference: number;
}

interface SightTraversal {
  readonly world: WorldView;
  readonly targetX: number;
  readonly targetY: number;
  readonly targetHeight: number;
  x: number;
  y: number;
  elevation: SightElevation;
}

interface GridRay {
  readonly stepX: number;
  readonly stepY: number;
  readonly deltaX: number;
  readonly deltaY: number;
  nextX: number;
  nextY: number;
}

type SightCell = Readonly<{ x: number; y: number }>;

/**
 * Returns whether a direct tile-space ray crosses a monotonic terrain profile.
 * One elevation transition between endpoints is visible; a crest or dip that
 * reverses vertical direction remains occluded.
 */
export function hasTerrainLineOfSight(input: TerrainSight): boolean {
  const fromHeight = input.world.groundAt(input.from.x, input.from.y);
  const toHeight = input.world.groundAt(input.to.x, input.to.y);
  if (Math.abs(fromHeight - toHeight) >
      input.maximumHeightDifference + SIGHT_HEIGHT_EPSILON) return false;
  return traceSightCells(input, fromHeight, toHeight);
}

function traceSightCells(
  input: TerrainSight,
  fromHeight: number,
  toHeight: number,
): boolean {
  const traversal = createTraversal(input, fromHeight, toHeight);
  const ray = createGridRay(input);
  while (!reachedTarget(traversal)) {
    if (!advanceSightRay(traversal, ray)) return false;
  }
  return true;
}

function createTraversal(
  input: TerrainSight,
  fromHeight: number,
  toHeight: number,
): SightTraversal {
  return {
    world: input.world,
    targetX: Math.floor(input.to.x),
    targetY: Math.floor(input.to.y),
    targetHeight: toHeight,
    x: Math.floor(input.from.x),
    y: Math.floor(input.from.y),
    elevation: { lastHeight: fromHeight, direction: 0 },
  };
}

function createGridRay(input: TerrainSight): GridRay {
  const dx = input.to.x - input.from.x;
  const dy = input.to.y - input.from.y;
  const stepX = Math.sign(dx);
  const stepY = Math.sign(dy);
  return {
    stepX,
    stepY,
    deltaX: dx === 0 ? Infinity : Math.abs(1 / dx),
    deltaY: dy === 0 ? Infinity : Math.abs(1 / dy),
    nextX: nextBoundaryTime(input.from.x, dx, stepX),
    nextY: nextBoundaryTime(input.from.y, dy, stepY),
  };
}

function nextBoundaryTime(
  coordinate: number,
  delta: number,
  step: number,
): number {
  if (delta === 0) return Infinity;
  const boundary = step > 0 ? Math.floor(coordinate) + 1 : Math.floor(coordinate);
  return (boundary - coordinate) / delta;
}

function reachedTarget(traversal: SightTraversal): boolean {
  return traversal.x === traversal.targetX &&
    traversal.y === traversal.targetY;
}

function advanceSightRay(
  traversal: SightTraversal,
  ray: GridRay,
): boolean {
  if (Math.abs(ray.nextX - ray.nextY) <= CORNER_EPSILON) {
    return crossGridCorner(traversal, ray);
  }
  if (ray.nextX < ray.nextY) {
    traversal.x += ray.stepX;
    ray.nextX += ray.deltaX;
  } else {
    traversal.y += ray.stepY;
    ray.nextY += ray.deltaY;
  }
  return sightCellIsClear(traversal, {
    x: traversal.x,
    y: traversal.y,
  });
}

function crossGridCorner(
  traversal: SightTraversal,
  ray: GridRay,
): boolean {
  const nextX = traversal.x + ray.stepX;
  const nextY = traversal.y + ray.stepY;
  if (!sightCellIsClear(traversal, {
    x: nextX,
    y: traversal.y,
  }, false) || !sightCellIsClear(traversal, {
    x: traversal.x,
    y: nextY,
  }, false)) return false;
  traversal.x = nextX;
  traversal.y = nextY;
  ray.nextX += ray.deltaX;
  ray.nextY += ray.deltaY;
  return sightCellIsClear(traversal, { x: nextX, y: nextY });
}

function sightCellIsClear(
  traversal: SightTraversal,
  cell: SightCell,
  commit = true,
): boolean {
  const target = cell.x === traversal.targetX &&
    cell.y === traversal.targetY;
  if (!target && !traversal.world.isWalkable(cell.x, cell.y)) return false;
  const height = traversal.world.groundAt(cell.x + 0.5, cell.y + 0.5);
  const elevation = advanceSightElevation(traversal.elevation, height);
  if (!elevation ||
      !advanceSightElevation(elevation, traversal.targetHeight)) return false;
  if (commit) traversal.elevation = elevation;
  return true;
}
