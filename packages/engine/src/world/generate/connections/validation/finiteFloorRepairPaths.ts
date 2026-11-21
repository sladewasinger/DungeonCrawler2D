import { carveAt, insideBounds, isCarved, localIndex } from "../../finiteFloorBuffers.js";
import type { FloorMovementAnalysis } from "../../finiteFloorMovement.js";
import { FLOOR_SEMANTIC, type FloorAttempt, type FloorBounds, type FloorPoint } from "../../finiteFloorTypes.js";

export function carvePathsToReachableCells(input: {
  readonly buffers: FloorAttempt["buffers"];
  readonly bounds: FloorBounds;
  readonly reachable: Uint8Array;
  readonly targets: readonly FloorPoint[];
  readonly movement: Pick<FloorMovementAnalysis, "edgeIsLegal">;
}): readonly (readonly FloorPoint[])[] {
  const search = findReachableFrontier(input);
  return input.targets.map((target) => carveRestoredPath({ ...input, ...search, target }));
}

function findReachableFrontier(input: {
  readonly buffers: FloorAttempt["buffers"];
  readonly bounds: FloorBounds;
  readonly reachable: Uint8Array;
  readonly movement: Pick<FloorMovementAnalysis, "edgeIsLegal">;
}): { readonly previous: Int32Array } {
  const previous = new Int32Array(input.buffers.tiles.length).fill(-1);
  const queue = new Int32Array(input.buffers.tiles.length);
  const state = seedReachableFrontier({ ...input, previous, queue });
  for (let cursor = 0; cursor < state.tail; cursor++) {
    const current = state.queue[cursor] ?? -1;
    if (current >= 0) state.tail = visitConnectivityNeighbors({ ...input, ...state, current });
  }
  return { previous };
}

function seedReachableFrontier(input: {
  readonly buffers: FloorAttempt["buffers"];
  readonly reachable: Uint8Array;
  readonly previous: Int32Array;
  readonly queue: Int32Array;
}): { readonly previous: Int32Array; readonly queue: Int32Array; tail: number } {
  let tail = 0;
  for (let index = 0; index < input.reachable.length; index++) {
    if (input.reachable[index] !== 1) continue;
    input.previous[index] = index;
    input.queue[tail++] = index;
  }
  return { previous: input.previous, queue: input.queue, tail };
}

function visitConnectivityNeighbors(input: {
  readonly buffers: FloorAttempt["buffers"];
  readonly bounds: FloorBounds;
  readonly previous: Int32Array;
  readonly queue: Int32Array;
  readonly current: number;
  readonly movement: Pick<FloorMovementAnalysis, "edgeIsLegal">;
  tail: number;
}): number {
  const point = pointAtIndex(input.bounds, input.current);
  for (const direction of CARDINAL) {
    const next = { x: point.x + direction.x, y: point.y + direction.y };
    if (!insideBounds({ bounds: input.bounds, ...next })) continue;
    const nextIndex = localIndex({ bounds: input.bounds, ...next });
    if ((input.previous[nextIndex] ?? -1) >= 0 || !connectableCell(input.buffers, nextIndex)
      || (!input.movement.edgeIsLegal(point, next) && !repairablePathCell(input.buffers, nextIndex))) continue;
    input.previous[nextIndex] = input.current;
    input.queue[input.tail++] = nextIndex;
  }
  return input.tail;
}

function carveRestoredPath(input: {
  readonly buffers: FloorAttempt["buffers"];
  readonly bounds: FloorBounds;
  readonly previous: Int32Array;
  readonly target: FloorPoint;
  readonly movement: Pick<FloorMovementAnalysis, "edgeIsLegal">;
}): readonly FloorPoint[] {
  const targetIndex = localIndex({ bounds: input.bounds, ...input.target });
  if ((input.previous[targetIndex] ?? -1) < 0) return [];
  const path: FloorPoint[] = [];
  for (let current = targetIndex; input.previous[current] !== current; current = input.previous[current] ?? -1) {
    const point = pointAtIndex(input.bounds, current);
    const previous = pointAtIndex(input.bounds, input.previous[current] ?? current);
    repairTransitionHeight({ ...input, from: previous, to: point, toIndex: current });
    path.push(point);
    carveAt({
      buffers: input.buffers, bounds: input.bounds, point,
      semantic: FLOOR_SEMANTIC.Transition, regionId: input.buffers.region[targetIndex] ?? 1,
    });
    input.buffers.protectedCells[current] = 1;
  }
  path.push(pointAtIndex(input.bounds, targetIndex));
  input.buffers.protectedCells[targetIndex] = 1;
  return path.reverse();
}

function repairTransitionHeight(input: {
  readonly buffers: FloorAttempt["buffers"];
  readonly bounds: FloorBounds;
  readonly movement: Pick<FloorMovementAnalysis, "edgeIsLegal">;
  readonly from: FloorPoint;
  readonly to: FloorPoint;
  readonly toIndex: number;
}): void {
  if (input.movement.edgeIsLegal(input.from, input.to) || !repairablePathCell(input.buffers, input.toIndex)) return;
  const fromIndex = localIndex({ bounds: input.bounds, ...input.from });
  input.buffers.height[input.toIndex] = input.buffers.height[fromIndex] ?? 0;
  input.buffers.featureHeight[input.toIndex] = 0;
}

function connectableCell(buffers: FloorAttempt["buffers"], index: number): boolean {
  return (buffers.roomWallIds[index] ?? -1) < 0
    && (!(buffers.protectedCells[index] ?? 0) || isCarved(buffers, index));
}

function repairablePathCell(buffers: FloorAttempt["buffers"], index: number): boolean {
  return unprotectedOpenCell(buffers, index) || protectedTransitionCell(buffers, index);
}

function unprotectedOpenCell(buffers: FloorAttempt["buffers"], index: number): boolean {
  return buffers.protectedCells[index] !== 1 && noAuthoredOwnership(buffers, index);
}

function protectedTransitionCell(buffers: FloorAttempt["buffers"], index: number): boolean {
  return buffers.protectedCells[index] === 1
    && buffers.semantic[index] === FLOOR_SEMANTIC.Transition
    && noAuthoredOwnership(buffers, index);
}

function noAuthoredOwnership(buffers: FloorAttempt["buffers"], index: number): boolean {
  return buffers.features[index] === 0
    && (buffers.roomIds[index] ?? -1) < 0
    && (buffers.roomWallIds[index] ?? -1) < 0;
}

function pointAtIndex(bounds: FloorBounds, index: number): FloorPoint {
  return { x: bounds.minX + index % bounds.width, y: bounds.minY + Math.floor(index / bounds.width) };
}

const CARDINAL = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }] as const;
