import { CHUNK_SIZE, type Chunk } from "../../core/types.js";
import { applyDescentStructure } from "../../features/descent/descent.js";
import type { ChunkCoordinate } from "../test-support/types.js";

export function compatibilityDescentChunk(input: {
  readonly seed: number;
  readonly floor: number;
  readonly coordinate: ChunkCoordinate;
}): Chunk {
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  const height = new Float32Array(CHUNK_SIZE * CHUNK_SIZE);
  const context = {
    chunk: { worldSeed: input.seed, floor: input.floor, ...input.coordinate },
    tiles,
    height,
  };
  applyDescentStructure(context);
  return {
    cx: input.coordinate.cx,
    cy: input.coordinate.cy,
    tiles,
    terrain: new Uint8Array(tiles.length),
    features: new Uint8Array(tiles.length),
    featureFaces: new Uint8Array(tiles.length),
    featureHeight: new Float32Array(tiles.length),
    height,
    zones: new Uint8Array(tiles.length),
  };
}
