import { insideBounds } from "../finiteFloorBuffers.js";
import type { FloorBounds, FloorPoint } from "../finiteFloorTypes.js";

export function validPathEndpoints(bounds: FloorBounds, from: FloorPoint, to: FloorPoint): boolean {
  return insideBounds({ bounds, ...from }) && insideBounds({ bounds, ...to });
}

export function restorePath(input: {
  readonly bounds: FloorBounds;
  readonly previous: Int32Array;
  readonly start: number;
  readonly target: number;
}): FloorPoint[] {
  const path: FloorPoint[] = [];
  let cursor = input.target;
  const visited = new Uint8Array(input.previous.length);
  while (cursor !== input.start) {
    if (cursor < 0 || cursor >= input.previous.length || visited[cursor] === 1) return [];
    visited[cursor] = 1;
    path.push(pointForIndex(input.bounds, cursor));
    cursor = input.previous[cursor] ?? -1;
  }
  path.push(pointForIndex(input.bounds, input.start));
  return path.reverse();
}

function pointForIndex(bounds: FloorBounds, index: number): FloorPoint {
  return { x: bounds.minX + index % bounds.width, y: bounds.minY + Math.floor(index / bounds.width) };
}
