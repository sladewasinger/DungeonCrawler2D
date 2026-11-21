import { insideBounds, isCarved, localIndex } from "../finiteFloorBuffers.js";
import type { FiniteFloorWorkBudget } from "../budget/finiteFloorWorkBudget.js";
import type { FloorBounds, FloorBuffers, FloorPoint } from "../finiteFloorTypes.js";

const CARDINAL = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
] as const;

interface PathRequest {
  readonly buffers: FloorBuffers; readonly bounds: FloorBounds;
  readonly from: FloorPoint; readonly to: FloorPoint; readonly blocked?: FloorPoint;
}

export interface CarvedDistanceWorkspace {
  readonly seen: Int32Array; readonly distance: Int16Array;
  readonly queue: Int32Array; stamp: number;
}

export function createCarvedDistanceWorkspace(cellCount: number): CarvedDistanceWorkspace {
  return {
    seen: new Int32Array(cellCount), distance: new Int16Array(cellCount),
    queue: new Int32Array(cellCount), stamp: 0,
  };
}

export function carvedDistanceAtLeast(input: PathRequest & {
  readonly minimum: number; readonly workspace?: CarvedDistanceWorkspace;
  readonly budget?: FiniteFloorWorkBudget;
}): boolean {
  const workspace = input.workspace ?? createCarvedDistanceWorkspace(input.buffers.tiles.length);
  const stamp = nextWorkspaceStamp(workspace);
  const start = localIndex({ bounds: input.bounds, ...input.from });
  let queueLength = 1;
  workspace.queue[0] = start;
  workspace.seen[start] = stamp;
  workspace.distance[start] = 0;
  for (let cursor = 0; cursor < queueLength; cursor++) {
    if (input.budget && !input.budget.consumeCell()) return false;
    const index = workspace.queue[cursor] ?? -1;
    const point = pointAtIndex(input.bounds, index);
    const current = workspace.distance[index] ?? 0;
    if (current >= input.minimum) return true;
    queueLength = appendDistanceNeighbors({ ...input, point, stamp, queueLength, workspace, current });
  }
  return false;
}

function appendDistanceNeighbors(input: PathRequest & {
  readonly point: FloorPoint; readonly stamp: number;
  readonly workspace: CarvedDistanceWorkspace; readonly queueLength: number; readonly current: number;
}): number {
  let queueLength = input.queueLength;
  for (const direction of CARDINAL) {
    const next = { x: input.point.x + direction.x, y: input.point.y + direction.y };
    const nextIndex = localIndex({ bounds: input.bounds, ...next });
    if (!distanceCellCanBeVisited({ ...input, next, nextIndex })) continue;
    input.workspace.seen[nextIndex] = input.stamp;
    input.workspace.distance[nextIndex] = input.current + 1;
    input.workspace.queue[queueLength] = nextIndex;
    queueLength += 1;
    if (samePoint(next, input.to)) return queueLength;
  }
  return queueLength;
}

function distanceCellCanBeVisited(input: PathRequest & {
  readonly next: FloorPoint; readonly nextIndex: number;
  readonly workspace: CarvedDistanceWorkspace; readonly stamp: number;
}): boolean {
  return insideBounds({ bounds: input.bounds, ...input.next })
    && !samePoint(input.blocked, input.next)
    && input.workspace.seen[input.nextIndex] !== input.stamp
    && isCarved(input.buffers, input.nextIndex);
}

function nextWorkspaceStamp(workspace: CarvedDistanceWorkspace): number {
  workspace.stamp += 1;
  if (workspace.stamp === 0) {
    workspace.seen.fill(0);
    workspace.stamp = 1;
  }
  return workspace.stamp;
}

function pointAtIndex(bounds: Pick<FloorBounds, "minX" | "minY" | "width">, index: number): FloorPoint {
  return { x: bounds.minX + (index % bounds.width), y: bounds.minY + Math.floor(index / bounds.width) };
}

function samePoint(a: FloorPoint | undefined, b: FloorPoint): boolean {
  return a?.x === b.x && a.y === b.y;
}
