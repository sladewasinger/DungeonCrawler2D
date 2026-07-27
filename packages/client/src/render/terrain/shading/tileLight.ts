/** Maximum level for authored torch seeds. */
export const LIGHT_MAX = 14;

/** Terrain4's full-brightness threshold for the shared light palette. */
export const LIGHT_CURVE_FULL_LEVEL = 4.5;

/** A dynamic light source accepted by the terrain renderer seam. */
export interface DynamicLightSeed {
  readonly tileX: number;
  readonly tileY: number;
  readonly level: number;
}
