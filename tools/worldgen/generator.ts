// Loads the engine's chunk generator to render.

import type { Chunk } from "../../packages/engine/src/world/types.js";

export type GenerateChunkFn = (
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
) => Chunk;

export async function loadGenerator(): Promise<GenerateChunkFn> {
  const mod: unknown = await import("../../packages/engine/src/world/generate.js");
  const fn = (mod as { generateChunk?: unknown }).generateChunk;
  if (typeof fn !== "function") {
    throw new Error("no generateChunk export found at packages/engine/src/world/generate.js");
  }
  return fn as GenerateChunkFn;
}
