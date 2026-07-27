// Loads the engine's chunk generator to render.

import type { Chunk } from "../../packages/engine/src/world/types.js";

export interface GenerateChunkArgs {
  readonly worldSeed: number;
  readonly floor: number;
  readonly cx: number;
  readonly cy: number;
}

export type GenerateChunkFn = (args: GenerateChunkArgs) => Chunk;

export async function loadGenerator(): Promise<GenerateChunkFn> {
  const mod: unknown = await import("../../packages/engine/src/world/generate.js");
  const fn = (mod as { generateChunk?: unknown }).generateChunk;
  if (typeof fn !== "function") {
    throw new Error("no generateChunk export found at packages/engine/src/world/generate.js");
  }
  const generateChunk = fn as (...values: number[]) => Chunk;
  return (args) => generateChunk(...[args.worldSeed, args.floor, args.cx, args.cy]);
}
