import type { Chunk } from "../../core/types.js";

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
