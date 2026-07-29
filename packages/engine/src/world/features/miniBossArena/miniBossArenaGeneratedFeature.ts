import { CHUNK_SIZE, type Chunk } from "../../core/types.js";

interface GeneratedFeatureWorld {
  readonly featureAt?: (x: number, y: number) => number;
  readonly getChunk?: (cx: number, cy: number) => Pick<Chunk, "features">;
}

export function generatedMiniBossArenaFeatureAt(
  world: GeneratedFeatureWorld,
  x: number,
  y: number,
): number | undefined {
  if (!world.getChunk) return world.featureAt?.(x, y);
  const cx = Math.floor(x / CHUNK_SIZE);
  const cy = Math.floor(y / CHUNK_SIZE);
  const localX = x - cx * CHUNK_SIZE;
  const localY = y - cy * CHUNK_SIZE;
  return world.getChunk(cx, cy).features[localY * CHUNK_SIZE + localX];
}
