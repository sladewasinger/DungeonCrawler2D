import { insideBounds, localIndex } from "./finiteFloorBuffers.js";
import type { FloorBounds, FloorBuffers } from "./finiteFloorTypes.js";

export function countBiomeComponents(input: { readonly cells: readonly { x: number; y: number; index: number }[]; readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly biome: number }): number {
  return countPlaneComponents({ cells: input.cells, plane: input.buffers.biome, bounds: input.bounds, value: input.biome });
}

export function countPlaneComponents(input: { readonly cells: readonly { x: number; y: number; index: number }[]; readonly plane: Uint8Array; readonly bounds: FloorBounds; readonly value: number }): number {
  const remaining = new Uint8Array(input.plane.length);
  for (const cell of input.cells) remaining[cell.index] = 1;
  let components = 0;
  for (const cell of input.cells) {
    if (!remaining[cell.index]) continue;
    components++;
    consumeComponent({ ...input, remaining, start: cell });
  }
  return components;
}

function consumeComponent(input: { readonly plane: Uint8Array; readonly bounds: FloorBounds; readonly value: number; readonly remaining: Uint8Array; readonly start: { x: number; y: number; index: number } }): void {
  const queue = [input.start];
  input.remaining[input.start.index] = 0;
  for (let cursor = 0; cursor < queue.length; cursor++) expandComponent({ ...input, queue, cursor });
}

function expandComponent(input: { readonly plane: Uint8Array; readonly bounds: FloorBounds; readonly value: number; readonly remaining: Uint8Array; readonly queue: Array<{ x: number; y: number }>; readonly cursor: number }): void {
  const point = input.queue[input.cursor];
  if (!point) return;
  for (const next of neighbors(point)) {
    if (!insideBounds({ bounds: input.bounds, ...next }) || !sameValue(input, next)) continue;
    const index = localIndex({ bounds: input.bounds, ...next });
    if (!input.remaining[index]) continue;
    input.remaining[index] = 0;
    input.queue.push(next);
  }
}

function sameValue(input: { readonly plane: Uint8Array; readonly bounds: FloorBounds; readonly value: number }, point: { x: number; y: number }): boolean {
  const index = localIndex({ bounds: input.bounds, ...point });
  return input.plane[index] === input.value;
}

function neighbors(point: { x: number; y: number }): Array<{ x: number; y: number }> {
  return [{ x: point.x + 1, y: point.y }, { x: point.x - 1, y: point.y }, { x: point.x, y: point.y + 1 }, { x: point.x, y: point.y - 1 }];
}
