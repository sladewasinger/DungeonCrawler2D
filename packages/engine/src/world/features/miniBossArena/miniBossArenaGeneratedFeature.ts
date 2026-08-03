import { CHUNK_SIZE, type Chunk } from "../../core/types.js";
import type { GeneratedMiniBossArena } from "../../generate/finiteFloor.js";
import type { MiniBossArenaChunk, MiniBossArenaSite } from "./miniBossArena.js";

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

export function generatedArenaForChunk(chunk: MiniBossArenaChunk): MiniBossArenaSite | null {
  const floor = chunk.generatedFloor;
  if (!floor) return null;
  const arena = floor.miniBossArenas.find((candidate) => candidate.chunk.cx === chunk.cx && candidate.chunk.cy === chunk.cy);
  return arena ? asMiniBossArenaSite(arena) : null;
}

function asMiniBossArenaSite(arena: GeneratedMiniBossArena): MiniBossArenaSite {
  return { key: arena.key, chunk: arena.chunk, bounds: arena.bounds, interior: arena.interior, center: arena.center, gates: arena.gates, platforms: arena.platforms };
}
