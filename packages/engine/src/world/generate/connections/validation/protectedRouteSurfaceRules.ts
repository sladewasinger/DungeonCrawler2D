import { SOLID_TILES, TERRAIN, TILE } from "../../../core/types.js";
import { insideBounds, localIndex } from "../../finiteFloorBuffers.js";
import type { FloorMovementAnalysis } from "../../finiteFloorMovement.js";
import type { FloorAttempt, FloorBounds, FloorPoint } from "../../finiteFloorTypes.js";

export type RouteDirection = "east" | "north" | "south" | "west";

export interface ProtectedRouteSurfacePlanes {
  readonly tiles: ArrayLike<number>;
  readonly terrain: ArrayLike<number>;
  readonly features: ArrayLike<number>;
  readonly protectedCells: ArrayLike<number>;
}

const DIRECTIONS: Readonly<Record<string, RouteDirection>> = {
  "1,0": "east",
  "-1,0": "west",
  "0,1": "south",
  "0,-1": "north",
};

export function protectedSurfaceFailure(input: {
  readonly attempt: Pick<FloorAttempt, "buffers">;
  readonly bounds: FloorBounds;
  readonly movement: FloorMovementAnalysis;
  readonly point: FloorPoint;
}): string | null {
  if (!insideBounds({ bounds: input.bounds, ...input.point })) return "leaves finite bounds";
  const index = localIndex({ bounds: input.bounds, ...input.point });
  return materialFailure(input.attempt.buffers, index)
    ?? reservationFailure(input.attempt.buffers.protectedCells[index], input.movement.reachable[index]);
}

function materialFailure(buffers: FloorAttempt["buffers"], index: number): string | null {
  if (buffers.tiles[index] !== TILE.Floor) return `has tile ${buffers.tiles[index]}`;
  if (buffers.terrain[index] === TERRAIN.Void) return "has Void terrain";
  const feature = buffers.features[index] ?? TILE.Floor;
  return SOLID_TILES.has(feature) ? `has blocking feature ${feature}` : null;
}

export function isProtectedRouteSurfaceWalkable(planes: ProtectedRouteSurfacePlanes, index: number): boolean {
  const feature = planes.features[index] ?? TILE.Floor;
  return planes.tiles[index] === TILE.Floor
    && planes.terrain[index] !== TERRAIN.Void
    && !SOLID_TILES.has(feature)
    && (planes.protectedCells[index] ?? 0) === 1;
}

function reservationFailure(protectedCell: number | undefined, reachable: number | undefined): string | null {
  if ((protectedCell ?? 0) !== 1) return "is not protected";
  return (reachable ?? 0) === 1 ? null : "is not spawn-reachable";
}

export function edgeDirection(from: FloorPoint, to: FloorPoint): RouteDirection | null {
  return DIRECTIONS[`${to.x - from.x},${to.y - from.y}`] ?? null;
}

export function edgeKey(left: FloorPoint, right: FloorPoint): string {
  const leftKey = pointKey(left);
  const rightKey = pointKey(right);
  return leftKey < rightKey ? `${leftKey}|${rightKey}` : `${rightKey}|${leftKey}`;
}

export function pointKey(point: FloorPoint): string {
  return `${point.x},${point.y}`;
}
