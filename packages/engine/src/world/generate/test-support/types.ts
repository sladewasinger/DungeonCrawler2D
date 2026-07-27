import { CHUNK_SIZE, TILE, type Chunk } from "../../types.js";
import { generateChunk } from "../index.js";

export type ChunkCache = Map<string, Chunk>;

export interface GenerationScope {
  readonly seed: number;
  readonly floor: number;
  readonly cache: ChunkCache;
}

export interface WorldPoint {
  readonly x: number;
  readonly y: number;
}

export interface ChunkCoordinate {
  readonly cx: number;
  readonly cy: number;
}

export const CLIMB_DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, -1], [1, 0], [0, 1], [-1, 0],
];

export function forEachChunkCoord(
  chunkRange: number,
  callback: (coordinate: ChunkCoordinate) => void,
): void {
  for (let cx = -chunkRange; cx <= chunkRange; cx++) {
    for (let cy = -chunkRange; cy <= chunkRange; cy++) callback({ cx, cy });
  }
}

export function scanStairs(scope: Omit<GenerationScope, "cache"> & { readonly chunkRange: number }): WorldPoint[] {
  const found: WorldPoint[] = [];
  forEachChunkCoord(scope.chunkRange, ({ cx, cy }) => addChunkStairs(found, scope, { cx, cy }));
  return found;
}

function addChunkStairs(found: WorldPoint[], scope: Omit<GenerationScope, "cache">, coordinate: ChunkCoordinate): void {
  const chunk = generateChunk({ worldSeed: scope.seed, floor: scope.floor, ...coordinate });
  for (let index = 0; index < chunk.tiles.length; index++) {
    if (chunk.tiles[index] !== TILE.Stairs) continue;
    found.push(worldPoint(coordinate, index));
  }
}

function worldPoint(coordinate: ChunkCoordinate, index: number): WorldPoint {
  const lx = index % CHUNK_SIZE;
  const ly = (index - lx) / CHUNK_SIZE;
  return { x: coordinate.cx * CHUNK_SIZE + lx, y: coordinate.cy * CHUNK_SIZE + ly };
}
