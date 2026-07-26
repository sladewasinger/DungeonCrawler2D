import { SCREEN_TILE_PX } from "../boot/assetManifest.js";
import { depthForEntity } from "../render/entities/depthSort.js";

export type GroundedVisualLayer =
  | "blood"
  | "corpse"
  | "corpseFragment"
  | "item";

const LAYER_DEPTH_BIAS: Readonly<Record<GroundedVisualLayer, number>> = {
  blood: -0.35,
  corpse: -0.3,
  corpseFragment: -0.25,
  item: 0,
};

export interface GroundedVisualPlacement {
  readonly groundedRow: number;
  readonly projectedScreenY: number;
  readonly depth: number;
  readonly groundHeight: number;
  readonly layer: GroundedVisualLayer;
}

/**
 * One inspectable contract for ground-anchored visuals.
 *
 * Elevation shifts the drawn position onto the projected terrain surface, but never
 * changes its painter row. Terrain caps and wall facades are keyed to the grounded
 * footprint, so subtracting elevation from depth can incorrectly bury raised effects.
 */
export function groundedVisualPlacement(
  rawScreenY: number,
  groundHeight: number,
  layer: GroundedVisualLayer,
  scatterScreenY = 0,
): GroundedVisualPlacement {
  const groundedScreenY = rawScreenY + scatterScreenY;
  const groundedRow = groundedScreenY / SCREEN_TILE_PX;
  return {
    groundedRow,
    projectedScreenY: groundedScreenY - groundHeight * SCREEN_TILE_PX,
    depth: depthForEntity(groundedRow) + LAYER_DEPTH_BIAS[layer],
    groundHeight,
    layer,
  };
}
