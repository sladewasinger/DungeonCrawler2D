import { CHUNK_SIZE, TILE, TOPOLOGY, ZONE } from "./types.js";

/**
 * Seal wall-enclosed floor pockets that touch neither a corridor, a
 * feature tile, nor the chunk border (border pockets may continue into
 * the neighbor chunk, so they survive). Keeps almost every open tile
 * reachable from the corridor network.
 */

/** Floor tiles that flood-fill should start from: corridors, features, and the chunk edge. */
interface PocketMap {
  tiles: Uint8Array;
  corridorCarved: Uint8Array;
  zones: Uint8Array;
  size: number;
}

function isReachSeed({ tiles, corridorCarved, zones, size, i }: PocketMap & { i: number }): boolean {
  const lx = i % size;
  const ly = (i - lx) / size;
  const onBorder = lx === 0 || ly === 0 || lx === size - 1 || ly === size - 1;
  const isSeedTile = tiles[i] === TILE.Stairs || tiles[i] === TILE.DoorSafeRoom;
  return corridorCarved[i] === 1 || zones[i] !== ZONE.None || isSeedTile || onBorder;
}

function seedIndices({ tiles, corridorCarved, zones, size }: PocketMap): number[] {
  const seeds: number[] = [];
  for (let i = 0; i < size * size; i++) {
    if (tiles[i] === TOPOLOGY.Uncarved) continue;
    if (isReachSeed({ tiles, corridorCarved, zones, size, i })) seeds.push(i);
  }
  return seeds;
}

function orthoNeighbors(size: number, i: number): number[] {
  const lx = i % size;
  const ly = (i - lx) / size;
  return [
    lx > 0 ? i - 1 : -1,
    lx < size - 1 ? i + 1 : -1,
    ly > 0 ? i - size : -1,
    ly < size - 1 ? i + size : -1,
  ];
}

/** Visit one popped tile's neighbors, enqueueing any newly-reached floor tile. */
function visitNeighbors({ tiles, reached, size, i, queue }: { tiles: Uint8Array; reached: Uint8Array; size: number; i: number; queue: number[] }): void {
  for (const n of orthoNeighbors(size, i)) {
    if (n < 0 || reached[n] === 1 || tiles[n] === TOPOLOGY.Uncarved) continue;
    reached[n] = 1;
    queue.push(n);
  }
}

/** Flood-fill floor tiles reachable from `queue`, marking `reached` in place. */
function floodFill({ tiles, reached, size, queue }: { tiles: Uint8Array; reached: Uint8Array; size: number; queue: number[] }): void {
  while (queue.length > 0) {
    const i = queue.pop();
    if (i === undefined) break;
    visitNeighbors({ tiles, reached, size, i, queue });
  }
}

export function sealInteriorPockets(
  tiles: Uint8Array,
  corridorCarved: Uint8Array,
  zones: Uint8Array,
): void {
  const size = CHUNK_SIZE;
  const reached = new Uint8Array(size * size);
  const queue = seedIndices({ tiles, corridorCarved, zones, size });
  for (const i of queue) reached[i] = 1;

  floodFill({ tiles, reached, size, queue });

  for (let i = 0; i < size * size; i++) {
    if (tiles[i] !== TOPOLOGY.Uncarved && reached[i] === 0) tiles[i] = TOPOLOGY.Uncarved;
  }
}
