import { CHUNK_SIZE, TILE, TOPOLOGY } from "../../core/types.js";

export function floodFromBorder(tiles: Uint8Array): Uint8Array {
  const reached = new Uint8Array(tiles.length);
  const queue = reachSeeds(tiles, reached);
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head];
    if (index === undefined) continue;
    queue.push(...unreachedNeighbors({ index, tiles, reached }));
  }
  return reached;
}

function reachSeeds(tiles: Uint8Array, reached: Uint8Array): number[] {
  const seeds: number[] = [];
  for (let index = 0; index < tiles.length; index++) {
    if (isBlocked(tiles[index]) || !isReachSeed(tiles, index)) continue;
    reached[index] = 1;
    seeds.push(index);
  }
  return seeds;
}

function unreachedNeighbors(input: { readonly index: number; readonly tiles: Uint8Array; readonly reached: Uint8Array }): number[] {
  return orthogonalNeighbors(input.index).filter((neighbor) => {
    if (neighbor < 0 || input.reached[neighbor] === 1 || isBlocked(input.tiles[neighbor])) return false;
    input.reached[neighbor] = 1;
    return true;
  });
}

function isReachSeed(tiles: Uint8Array, index: number): boolean {
  const { x, y } = localPoint(index);
  const border = x === 0 || y === 0 || x === CHUNK_SIZE - 1 || y === CHUNK_SIZE - 1;
  return border || tiles[index] === TILE.Stairs || tiles[index] === TILE.DoorSafeRoom;
}

function orthogonalNeighbors(index: number): number[] {
  const { x, y } = localPoint(index);
  return [x > 0 ? index - 1 : -1, x < CHUNK_SIZE - 1 ? index + 1 : -1, y > 0 ? index - CHUNK_SIZE : -1, y < CHUNK_SIZE - 1 ? index + CHUNK_SIZE : -1];
}

function localPoint(index: number): { x: number; y: number } { const x = index % CHUNK_SIZE; return { x, y: (index - x) / CHUNK_SIZE }; }
function isBlocked(tile: number | undefined): boolean { return tile === TILE.Void || tile === TOPOLOGY.Uncarved; }
