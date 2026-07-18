import { CHUNK_SIZE, TILE, ZONE } from "./types";

/**
 * Seal wall-enclosed floor pockets that touch neither a corridor, a
 * feature tile, nor the chunk border (border pockets may continue into
 * the neighbor chunk, so they survive). Keeps almost every open tile
 * reachable from the corridor network.
 */
export function sealInteriorPockets(
  tiles: Uint8Array,
  corridorCarved: Uint8Array,
  zones: Uint8Array,
): void {
  const size = CHUNK_SIZE;
  const reached = new Uint8Array(size * size);
  const queue: number[] = [];

  for (let i = 0; i < size * size; i++) {
    if (tiles[i] === TILE.Wall) continue;
    const lx = i % size;
    const ly = (i - lx) / size;
    const onBorder = lx === 0 || ly === 0 || lx === size - 1 || ly === size - 1;
    const isSeedTile = tiles[i] === TILE.Stairs || tiles[i] === TILE.DoorSafeRoom;
    if (corridorCarved[i] === 1 || zones[i] !== ZONE.None || isSeedTile || onBorder) {
      reached[i] = 1;
      queue.push(i);
    }
  }

  while (queue.length > 0) {
    const i = queue.pop()!;
    const lx = i % size;
    const ly = (i - lx) / size;
    const neighbors = [
      lx > 0 ? i - 1 : -1,
      lx < size - 1 ? i + 1 : -1,
      ly > 0 ? i - size : -1,
      ly < size - 1 ? i + size : -1,
    ];
    for (const n of neighbors) {
      if (n < 0 || reached[n] === 1 || tiles[n] === TILE.Wall) continue;
      reached[n] = 1;
      queue.push(n);
    }
  }

  for (let i = 0; i < size * size; i++) {
    if (tiles[i] !== TILE.Wall && reached[i] === 0) tiles[i] = TILE.Wall;
  }
}
