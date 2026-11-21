import { insideBounds, localIndex } from "../../finiteFloorBuffers.js";
import type { FloorBounds, FloorPoint } from "../../finiteFloorTypes.js";

export interface BridgeSearchWorkspace {
  readonly previous: Int32Array;
  readonly marks: Int32Array;
  readonly queue: Int32Array;
  generation: number;
}

interface BridgeSearchInput {
  readonly bounds: FloorBounds;
  readonly start: FloorPoint;
  readonly target: FloorPoint;
  readonly canUseLeg: (from: FloorPoint, to: FloorPoint) => boolean;
  readonly workspace?: BridgeSearchWorkspace;
}

export function createBridgeSearchWorkspace(bounds: FloorBounds): BridgeSearchWorkspace {
  const cells = bounds.width * bounds.height;
  return { previous: new Int32Array(cells), marks: new Int32Array(cells), queue: new Int32Array(cells), generation: 0 };
}

export function findBridgeRoute(input: BridgeSearchInput): readonly FloorPoint[] | null {
  if (!validEndpoints(input)) return null;
  const start = localIndex({ bounds: input.bounds, ...input.start });
  const target = localIndex({ bounds: input.bounds, ...input.target });
  const workspace = input.workspace ?? createBridgeSearchWorkspace(input.bounds);
  const previous = workspace.previous;
  const queue = workspace.queue;
  const generation = nextGeneration(workspace);
  const queueLength = 1;
  queue[0] = start;
  previous[start] = start;
  workspace.marks[start] = generation;
  return searchBridge({ bounds: input.bounds, canUseLeg: input.canUseLeg, previous, marks: workspace.marks, generation, queue, queueLength, start, target });
}

function nextGeneration(workspace: BridgeSearchWorkspace): number {
  if (workspace.generation >= 0x7fff_ffff) {
    workspace.marks.fill(0);
    workspace.generation = 1;
    return workspace.generation;
  }
  workspace.generation += 1;
  return workspace.generation;
}

function validEndpoints(input: BridgeSearchInput): boolean {
  return insideBounds({ bounds: input.bounds, ...input.start })
    && insideBounds({ bounds: input.bounds, ...input.target });
}

function searchBridge(input: Pick<BridgeSearchInput, "bounds" | "canUseLeg"> & { readonly previous: Int32Array; readonly marks: Int32Array; readonly generation: number; readonly queue: Int32Array; readonly queueLength: number; readonly start: number; readonly target: number }): readonly FloorPoint[] | null {
  let queueLength = input.queueLength;
  for (let cursor = 0; cursor < queueLength; cursor++) {
    const index = input.queue[cursor] ?? -1;
    if (index < 0) continue;
    if (index === input.target) {
      return restoreBridgeRoute(input);
    }
    const point = pointForIndex(input.bounds, index);
    for (const direction of CARDINAL) {
      queueLength = visitNeighbor({ ...input, point, index, queueLength }, direction);
    }
  }
  return null;
}

function visitNeighbor(input: Pick<BridgeSearchInput, "bounds" | "canUseLeg"> & { readonly point: FloorPoint; readonly index: number; readonly marks: Int32Array; readonly generation: number; readonly previous: Int32Array; readonly queue: Int32Array; readonly queueLength: number }, direction: FloorPoint): number {
  const next = { x: input.point.x + direction.x, y: input.point.y + direction.y };
  if (!insideBounds({ bounds: input.bounds, ...next }) || !input.canUseLeg(input.point, next)) return input.queueLength;
  const index = localIndex({ bounds: input.bounds, ...next });
  if (input.marks[index] === input.generation) return input.queueLength;
  input.marks[index] = input.generation;
  input.previous[index] = input.index;
  input.queue[input.queueLength] = index;
  return input.queueLength + 1;
}

function restoreBridgeRoute(input: { readonly bounds: FloorBounds; readonly previous: Int32Array; readonly start: number; readonly target: number }): FloorPoint[] {
  const path: FloorPoint[] = [];
  for (let cursor = input.target; cursor !== input.start; cursor = input.previous[cursor] ?? -1) {
    path.push(pointForIndex(input.bounds, cursor));
  }
  path.push(pointForIndex(input.bounds, input.start));
  return path.reverse();
}

function pointForIndex(bounds: FloorBounds, index: number): FloorPoint {
  return { x: bounds.minX + index % bounds.width, y: bounds.minY + Math.floor(index / bounds.width) };
}

const CARDINAL = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }] as const;
