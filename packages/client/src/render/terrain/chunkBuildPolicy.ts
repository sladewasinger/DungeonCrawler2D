import { TERRAIN_BAKE_CHUNK_PX } from "./terrainMetrics.js";

export const CHUNK_BAKE_PX = TERRAIN_BAKE_CHUNK_PX;
export const ROWS_PER_STEP = 1;
export const STRIPS_PER_BAKE_STEP = 4;
export const IMAGES_PER_STEP = 8;

export type BuildPhase =
  "page" | "structures" | "light" | "tiles" | "collect" | "pages" | "bake" | "images";

export function required<T>(value: T | null, message: string): T {
  if (value === null) throw new Error(message);
  return value;
}
