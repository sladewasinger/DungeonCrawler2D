import { SOLID_TILES, TILE } from "../../core/types.js";
import { forEachCell, insideBounds, localIndex, stampSolid } from "../finiteFloorBuffers.js";
import { FLOOR_SEMANTIC, type FloorBounds, type FloorBuffers, type FloorPoint } from "../finiteFloorTypes.js";

export function sealIsolatedTerrainPockets(input: {
  readonly buffers: FloorBuffers;
  readonly bounds: FloorBounds;
  readonly spawn: FloorPoint;
}): void {
  const reachable = floodPlainFloor(input.buffers, input.bounds, input.spawn);
  forEachCell(input.bounds, (x, y, index) => {
    if (reachable[index] || input.buffers.tiles[index] !== TILE.Floor) return;
    if (input.buffers.semantic[index] !== FLOOR_SEMANTIC.Corridor) return;
    stampSolid({ buffers: input.buffers, bounds: input.bounds, x, y, semantic: FLOOR_SEMANTIC.Solid });
  });
}

function floodPlainFloor(buffers: FloorBuffers, bounds: FloorBounds, spawn: FloorPoint): Uint8Array {
  const reachable = new Uint8Array(buffers.tiles.length);
  const start = { x: Math.floor(spawn.x), y: Math.floor(spawn.y) };
  if (!insideBounds({ bounds, ...start })) return reachable;
  const startIndex = localIndex({ bounds, ...start });
  if (!isPlainFloor(buffers, startIndex)) return reachable;
  const queue = [startIndex];
  reachable[startIndex] = 1;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor];
    if (index !== undefined) visitCardinalNeighbors({ buffers, bounds, reachable, queue }, index);
  }
  return reachable;
}

function visitCardinalNeighbors(
  state: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly reachable: Uint8Array; readonly queue: number[] },
  index: number,
): void {
  const width = state.bounds.width;
  const col = index % width;
  if (col > 0) tryEnqueue(state, index - 1);
  if (col + 1 < width) tryEnqueue(state, index + 1);
  if (index >= width) tryEnqueue(state, index - width);
  if (index + width < state.reachable.length) tryEnqueue(state, index + width);
}

function tryEnqueue(
  state: { readonly buffers: FloorBuffers; readonly reachable: Uint8Array; readonly queue: number[] },
  neighbor: number,
): void {
  if (state.reachable[neighbor] || !isPlainFloor(state.buffers, neighbor)) return;
  state.reachable[neighbor] = 1;
  state.queue.push(neighbor);
}

function isPlainFloor(buffers: FloorBuffers, index: number): boolean {
  return buffers.tiles[index] === TILE.Floor && !SOLID_TILES.has(buffers.features[index] ?? TILE.Floor);
}
