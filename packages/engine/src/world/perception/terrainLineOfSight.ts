import type { WorldView } from "../core/types.js";

const HEIGHT_EPSILON = 1e-6;
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
  readonly fromHeight: number;
  readonly toHeight: number;
  x: number;
  y: number;
}

interface GridRay {
  readonly stepX: number;
  readonly stepY: number;
  readonly deltaX: number;
  readonly deltaY: number;
  nextX: number;
  nextY: number;
}

type SightCell = Readonly<{ x: number; y: number; progress: number }>;

/**
 * Returns whether a direct tile-space ray remains on traversable terrain no
 * higher than either endpoint. The endpoint rule lets enemies see one level
 * up or down, while an intervening rise still hides anything behind it.
 */
export function hasTerrainLineOfSight(input: TerrainSight): boolean {
  const fromHeight = input.world.groundAt(input.from.x, input.from.y);
  const toHeight = input.world.groundAt(input.to.x, input.to.y);
  if (Math.abs(fromHeight - toHeight) >
      input.maximumHeightDifference + HEIGHT_EPSILON) return false;
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
    fromHeight,
    toHeight,
    x: Math.floor(input.from.x),
    y: Math.floor(input.from.y),
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
  const progress = Math.min(ray.nextX, ray.nextY);
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
    progress,
  });
}

function crossGridCorner(
  traversal: SightTraversal,
  ray: GridRay,
): boolean {
  const nextX = traversal.x + ray.stepX;
  const nextY = traversal.y + ray.stepY;
  const progress = ray.nextX;
  if (!sightCellIsClear(traversal, {
    x: nextX,
    y: traversal.y,
    progress,
  }) || !sightCellIsClear(traversal, {
    x: traversal.x,
    y: nextY,
    progress,
  })) return false;
  traversal.x = nextX;
  traversal.y = nextY;
  ray.nextX += ray.deltaX;
  ray.nextY += ray.deltaY;
  return sightCellIsClear(traversal, { x: nextX, y: nextY, progress });
}

function sightCellIsClear(
  traversal: SightTraversal,
  cell: SightCell,
): boolean {
  const { x, y, progress } = cell;
  if (x === traversal.targetX && y === traversal.targetY) return true;
  if (!traversal.world.isWalkable(x, y)) return false;
  const sightHeight = traversal.fromHeight +
    (traversal.toHeight - traversal.fromHeight) * progress;
  return traversal.world.groundAt(x + 0.5, y + 0.5) <=
    sightHeight + HEIGHT_EPSILON;
}
