import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { depthForEntity, depthForGroundEffect } from "../../render/entities/presentation/depthSort.js";

export type GroundedVisualLayer =
  | "blood"
  | "corpse"
  | "corpseFragment"
  | "item";

/** Screen-space Y foreshortening for circular marks lying on a floor viewed at ~45°. */
export const GROUND_DECAL_VERTICAL_SCALE = Math.SQRT1_2;

export interface GroundedVisualPlacement {
  readonly groundedRow: number;
  readonly projectedScreenY: number;
  readonly depth: number;
  readonly groundHeight: number;
  readonly layer: GroundedVisualLayer;
}

export interface GroundedVisualInput {
  readonly rawScreenY: number;
  readonly groundHeight: number;
  readonly layer: GroundedVisualLayer;
  readonly scatterScreenY?: number;
}

/**
 * One inspectable contract for ground-anchored visuals.
 *
 * Elevation shifts the drawn position onto the projected terrain surface. Blood,
 * corpses, and fragments use the row-local ground-effect band so their geometry
 * stays behind every entity standing on that floor. Items retain entity ordering.
 */
export function groundedVisualPlacement({
  rawScreenY,
  groundHeight,
  layer,
  scatterScreenY = 0,
}: GroundedVisualInput): GroundedVisualPlacement {
  const groundedScreenY = rawScreenY + scatterScreenY;
  const groundedRow = groundedScreenY / SCREEN_TILE_PX;
  return {
    groundedRow,
    projectedScreenY: groundedScreenY - groundHeight * SCREEN_TILE_PX,
    depth: layer === "item"
      ? depthForEntity(groundedRow)
      : depthForGroundEffect(groundedRow),
    groundHeight,
    layer,
  };
}
