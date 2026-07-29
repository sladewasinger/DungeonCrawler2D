import { CHUNK_SIZE, type Chunk } from "@dc2d/engine";
import type { World } from "@dc2d/engine";

export interface WorldPoint { readonly x: number; readonly y: number; }

export interface ChunkPointQuery {
  readonly point: WorldPoint;
  readonly terrain: number;
  readonly tile: number;
  readonly height: number;
}

export interface WorldPointSearch {
  readonly world: World;
  readonly predicate: (query: ChunkPointQuery) => boolean;
  readonly chunkRadius?: number;
}

export function findWorldPoint({ world, predicate, chunkRadius = 24 }: WorldPointSearch): WorldPoint | null {
  for (const chunkCoordinate of chunkCoordinates(chunkRadius)) {
    const point = findPointInChunk({ world, predicate, chunkCoordinate });
    if (point) return point;
  }
  return null;
}

function findPointInChunk(input: {
  readonly world: World;
  readonly predicate: WorldPointSearch["predicate"];
  readonly chunkCoordinate: { readonly cx: number; readonly cy: number };
}): WorldPoint | null {
  const { chunkCoordinate } = input;
  const chunk = input.world.getChunk(chunkCoordinate.cx, chunkCoordinate.cy);
  for (let index = 0; index < chunk.tiles.length; index++) {
    const point = pointAt(chunkCoordinate, index);
    if (input.predicate(queryAt(chunk, point, index))) return point;
  }
  return null;
}

function queryAt(chunk: Chunk, point: WorldPoint, index: number): ChunkPointQuery {
  return {
    point,
    terrain: chunk.terrain[index] ?? 0,
    tile: chunk.tiles[index] ?? 0,
    height: chunk.height[index] ?? 0,
  };
}

function chunkCoordinates(limit: number): Array<{ cx: number; cy: number }> {
  const coordinates: Array<{ cx: number; cy: number }> = [];
  for (let cx = -limit; cx <= limit; cx++) {
    for (let cy = -limit; cy <= limit; cy++) coordinates.push({ cx, cy });
  }
  return coordinates;
}

function pointAt(chunk: { readonly cx: number; readonly cy: number }, index: number): WorldPoint {
  const x = index % CHUNK_SIZE;
  return { x: chunk.cx * CHUNK_SIZE + x, y: chunk.cy * CHUNK_SIZE + (index - x) / CHUNK_SIZE };
}
