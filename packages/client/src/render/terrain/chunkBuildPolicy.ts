import { CHUNK_SIZE } from "@dc2d/engine";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";

export const CHUNK_PX = CHUNK_SIZE * SCREEN_TILE_PX;
export const ROWS_PER_STEP = 1;
export const STRIPS_PER_BAKE_STEP = 4;
export const IMAGES_PER_STEP = 8;

export type BuildPhase =
  "page" | "structures" | "light" | "tiles" | "collect" | "pages" | "bake" | "images";

export function required<T>(value: T | null, message: string): T {
  if (value === null) throw new Error(message);
  return value;
}
