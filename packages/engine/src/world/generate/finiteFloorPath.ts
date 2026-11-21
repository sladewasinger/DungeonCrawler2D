import { insideBounds, isCarved, localIndex } from "./finiteFloorBuffers.js";
import { restorePath, validPathEndpoints } from "./path/finiteFloorPathSupport.js";
import type { FloorBounds, FloorBuffers, FloorPoint, GeneratedConnector } from "./finiteFloorTypes.js";

export { carvedDistanceAtLeast, createCarvedDistanceWorkspace } from "./path/finiteFloorPathDistance.js";
export type { CarvedDistanceWorkspace } from "./path/finiteFloorPathDistance.js";

const CARDINAL = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
] as const;

interface PathRequest {
  readonly buffers: FloorBuffers;
  readonly bounds: FloorBounds;
  readonly from: FloorPoint;
  readonly to: FloorPoint;
  readonly blocked?: FloorPoint;
}

interface PathSearchState {
  readonly buffers: FloorBuffers;
  readonly bounds: FloorBounds;
  readonly blocked?: FloorPoint;
  readonly queue: FloorPoint[];
  readonly previous: Int32Array;
  point: FloorPoint;
}

export function carvedPath(input: PathRequest): FloorPoint[] {
  if (!validPathEndpoints(input.bounds, input.from, input.to)) return [];
  const previous = new Int32Array(input.buffers.tiles.length).fill(-1);
  const start = localIndex({ bounds: input.bounds, ...input.from });
  const target = localIndex({ bounds: input.bounds, ...input.to });
  const queue = [input.from];
  previous[start] = start;
  const state: PathSearchState = { ...input, queue, previous, point: input.from };
  for (let cursor = 0; cursor < queue.length && (previous[target] ?? -1) < 0; cursor++) {
    const point = queue[cursor];
    if (point) {
      state.point = point;
      expandPath(state);
    }
  }
  return (previous[target] ?? -1) < 0 ? [] : restorePath({ bounds: input.bounds, previous, start, target });
}

export function carvedPaths(input: {
  readonly buffers: FloorBuffers;
  readonly bounds: FloorBounds;
  readonly from: FloorPoint;
  readonly targets: readonly FloorPoint[];
}): FloorPoint[][] {
  if (!insideBounds({ bounds: input.bounds, ...input.from })) return input.targets.map(() => []);
  const previous = new Int32Array(input.buffers.tiles.length).fill(-1);
  const start = localIndex({ bounds: input.bounds, ...input.from });
  const queue = [input.from];
  previous[start] = start;
  const state: PathSearchState = { ...input, queue, previous, point: input.from };
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const point = queue[cursor];
    if (point) {
      state.point = point;
      expandPath(state);
    }
  }
  return input.targets.map((target) => {
    if (!insideBounds({ bounds: input.bounds, ...target })) return [];
    const targetIndex = localIndex({ bounds: input.bounds, ...target });
    return (previous[targetIndex] ?? -1) < 0 ? [] : restorePath({ bounds: input.bounds, previous, start, target: targetIndex });
  });
}

function expandPath(input: PathSearchState): void {
  const source = localIndex({ bounds: input.bounds, ...input.point });
  for (const direction of CARDINAL) visitNeighbor(input, source, direction);
}

function visitNeighbor(input: PathSearchState, source: number, direction: FloorPoint): void {
  const next = { x: input.point.x + direction.x, y: input.point.y + direction.y };
  if (!insideBounds({ bounds: input.bounds, ...next }) || samePoint(input.blocked, next)) return;
  const index = localIndex({ bounds: input.bounds, ...next });
  if ((input.previous[index] ?? -1) >= 0 || !isCarved(input.buffers, index)) return;
  input.previous[index] = source;
  input.queue.push(next);
}

export function currentLoopPathSaving(input: {
  readonly buffers: FloorBuffers;
  readonly bounds: FloorBounds;
  readonly connector: GeneratedConnector;
}): number {
  const point = { x: input.connector.x, y: input.connector.y };
  const neighbors = carvedNeighbors(input.buffers, input.bounds, point);
  let longestSaving = 0;
  for (let a = 0; a < neighbors.length; a++) {
    for (let b = a + 1; b < neighbors.length; b++) {
      const from = neighbors[a];
      const to = neighbors[b];
      if (!from || !to) continue;
      const saving = oppositePathSaving({ buffers: input.buffers, bounds: input.bounds, blocked: point, from, to });
      longestSaving = Math.max(longestSaving, saving);
    }
  }
  return longestSaving;
}

function carvedNeighbors(buffers: FloorBuffers, bounds: FloorBounds, point: FloorPoint): FloorPoint[] {
  return CARDINAL.map((direction) => ({ x: point.x + direction.x, y: point.y + direction.y }))
    .filter((neighbor) => insideBounds({ bounds, ...neighbor }) && isCarved(buffers, localIndex({ bounds, ...neighbor })));
}

function oppositePathSaving(input: {
  readonly buffers: FloorBuffers;
  readonly bounds: FloorBounds;
  readonly blocked: FloorPoint;
  readonly from?: FloorPoint;
  readonly to?: FloorPoint;
}): number {
  if (!input.from || !input.to || (input.from.x !== input.to.x && input.from.y !== input.to.y)) return 0;
  const path = carvedPath({ ...input, from: input.from, to: input.to });
  return path.length > 0 ? path.length - 3 : 0;
}

function samePoint(a: FloorPoint | undefined, b: FloorPoint): boolean {
  return a?.x === b.x && a.y === b.y;
}
