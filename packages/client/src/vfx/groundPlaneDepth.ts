import { SCREEN_TILE_PX } from "../boot/assetManifest.js";
import { depthForEntity } from "../render/entities/depthSort.js";

/**
 * Depth for a ground-anchored visual after elevation projection. The screen position
 * is shifted by ground Z, so its painter key must use that shifted row too.
 */
export function groundPlaneDepth(
  rawScreenY: number,
  groundHeight: number,
  scatterScreenY = 0,
): number {
  const projectedRow =
    (rawScreenY + scatterScreenY) / SCREEN_TILE_PX - groundHeight;
  return depthForEntity(projectedRow);
}
