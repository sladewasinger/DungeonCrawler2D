// Loads the chunk generator to render: the engine's default generator, or a
// candidate variant from packages/engine/src/world/variants/<name>/index.ts.

import type { Chunk } from "../../packages/engine/src/world/types.js";

export type GenerateChunkFn = (
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
) => Chunk;

export async function loadGenerator(variant: string | undefined): Promise<GenerateChunkFn> {
  const specifier = variant
    ? `../../packages/engine/src/world/variants/${variant}/index.js`
    : "../../packages/engine/src/world/generate.js";

  const mod: unknown = await import(specifier);
  const fn = (mod as { generateChunk?: unknown }).generateChunk;
  if (typeof fn !== "function") {
    throw new Error(`no generateChunk export found at ${specifier}`);
  }
  return fn as GenerateChunkFn;
}
