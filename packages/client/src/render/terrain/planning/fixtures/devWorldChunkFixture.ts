import { type Chunk } from "@dc2d/engine";

export function chunkTileKinds(chunk: Chunk): readonly number[] {
  return distinctValues(chunk.tiles);
}

export function chunkTerrainKinds(chunk: Chunk): readonly number[] {
  return distinctValues(chunk.terrain);
}

function distinctValues(values: ArrayLike<number>): readonly number[] {
  return [...new Set(Array.from(values))];
}
