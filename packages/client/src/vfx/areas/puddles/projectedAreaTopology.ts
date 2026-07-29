import { AREA_NEIGHBOR } from "./areaTileTopology.js";

export interface AreaProjectionPoint {
  readonly x: number;
  readonly y: number;
}

export type AreaProjector = (x: number, y: number) => AreaProjectionPoint;

interface AreaProjectionInput {
  readonly x: number;
  readonly y: number;
  readonly neighborMask: number;
  readonly project: AreaProjector;
}

const DIRECTIONS = [
  { dx: 0, dy: -1, bit: AREA_NEIGHBOR.north },
  { dx: 1, dy: 0, bit: AREA_NEIGHBOR.east },
  { dx: 0, dy: 1, bit: AREA_NEIGHBOR.south },
  { dx: -1, dy: 0, bit: AREA_NEIGHBOR.west },
] as const;

export function projectedNeighborMask(input: AreaProjectionInput): number {
  const center = input.project(input.x, input.y);
  let projectedMask = 0;
  for (const direction of DIRECTIONS) {
    if ((input.neighborMask & direction.bit) === 0) continue;
    const neighbor = input.project(input.x + direction.dx, input.y + direction.dy);
    projectedMask |= screenDirectionBit(center, neighbor);
  }
  return projectedMask;
}

function screenDirectionBit(
  center: AreaProjectionPoint,
  neighbor: AreaProjectionPoint,
): number {
  const dx = neighbor.x - center.x;
  const dy = neighbor.y - center.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? AREA_NEIGHBOR.east : AREA_NEIGHBOR.west;
  }
  return dy > 0 ? AREA_NEIGHBOR.south : AREA_NEIGHBOR.north;
}
