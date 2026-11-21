import { forEachCell, insideBounds, localIndex } from "../../finiteFloorBuffers.js";
import { isMovementWalkable, type FloorMovementAnalysis } from "../../finiteFloorMovement.js";
import type { FloorAttempt, FloorBounds, FloorPoint } from "../../finiteFloorTypes.js";

export { carvePathsToReachableCells } from "./finiteFloorRepairPaths.js";

export function validateRequiredComponents(input: {
  readonly attempt: FloorAttempt;
  readonly bounds: FloorBounds;
  readonly movement: FloorMovementAnalysis;
}): string[] {
  const failures: string[] = [];
  forEachCell(input.bounds, (x, y, index) => {
    if (!isMovementWalkable(input.attempt.buffers, index) || input.movement.reachable[index]) return;
    if (!insideSealedArena(input.attempt, { x, y })) failures.push(disconnectedCellFailure(input, { x, y }));
  });
  return failures.slice(0, 4);
}

export function disconnectedWalkableCells(input: {
  readonly buffers: FloorAttempt["buffers"];
  readonly bounds: FloorBounds;
  readonly reachable: Uint8Array;
  readonly sealedArenas: readonly { readonly bounds: { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number } }[];
}): FloorPoint[] {
  const cells: FloorPoint[] = [];
  forEachCell(input.bounds, (x, y, index) => {
    if (!isMovementWalkable(input.buffers, index) || input.reachable[index]) return;
    if (!input.sealedArenas.some(({ bounds }) => containsInterior(bounds, { x, y }))) cells.push({ x, y });
  });
  return cells;
}

function disconnectedCellFailure(input: {
  readonly attempt: FloorAttempt;
  readonly bounds: FloorBounds;
}, point: FloorPoint): string {
  const index = localIndex({ bounds: input.bounds, ...point });
  const details = disconnectedCellMetadata(input.attempt, index);
  return `required walkable cell ${point.x},${point.y} is disconnected (${details})`;
}

function disconnectedCellMetadata(attempt: FloorAttempt, index: number): string {
  const roomId = attempt.buffers.roomIds[index] ?? -1;
  const wallId = attempt.buffers.roomWallIds[index] ?? -1;
  const region = attempt.buffers.region[index] ?? 0;
  const protectedState = protectedCellState(attempt.buffers.protectedCells[index]);
  const territory = attempt.buffers.territory[index] ?? 0;
  const semantic = attempt.buffers.semantic[index] ?? 0;
  const territoryLayout = attempt.territoryLayouts[territory]?.layoutSignature ?? "none";
  return `${protectedState}, room ${roomId}, wall ${wallId}, region ${region}, territory ${territory}/${territoryLayout}, semantic ${semantic}`;
}

function protectedCellState(value: number | undefined): string {
  return value === 1 ? "protected" : "open";
}

function insideSealedArena(attempt: FloorAttempt, point: FloorPoint): boolean {
  return [...attempt.miniBossArenas, ...(attempt.bossArena ? [attempt.bossArena] : [])]
    .some(({ bounds }) => containsInterior(bounds, point));
}

function containsInterior(bounds: { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number }, point: FloorPoint): boolean {
  return point.x > bounds.x0 && point.x < bounds.x1 && point.y > bounds.y0 && point.y < bounds.y1;
}

export function isReachable(point: FloorPoint, reachable: Uint8Array, bounds: FloorBounds): boolean {
  const tile = { x: Math.floor(point.x), y: Math.floor(point.y) };
  return insideBounds({ bounds, ...tile }) && reachable[localIndex({ bounds, ...tile })] === 1;
}
