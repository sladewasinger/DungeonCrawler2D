import { TERRAIN, TILE, type Chunk } from "../core/types.js";
import type { WorldFeatures } from "../core/worldFeatures.js";

/** Refuse a partially disabled world at the generation boundary. */
export function assertChunkWorldFeatures(chunk: Chunk, features: WorldFeatures): Chunk {
  if (features.voidTerrain) return chunk;
  for (let index = 0; index < chunk.tiles.length; index++) {
    const leaked = chunk.tiles[index] === TILE.Void ||
      chunk.features[index] === TILE.Void ||
      chunk.terrain[index] === TERRAIN.Void;
    if (leaked) {
      throw new Error(`VOID cell ${index} leaked into disabled chunk (${chunk.cx}, ${chunk.cy})`);
    }
  }
  return chunk;
}
