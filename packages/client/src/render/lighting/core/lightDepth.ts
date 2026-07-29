import { SCREEN_TILE_PX } from "../../../boot/assetManifest.js";
import { depthForOccluder } from "../../entities/presentation/depthSort.js";
import type { ViewRect } from "../../terrain/streaming/streaming.js";
import { LIGHTING_VISUAL_STYLE } from "../lightingVisualStyle.js";

/** Above fixed-depth world particles, below the HUD's reserved 500,000 layer. */
export const DARKNESS_OVERLAY_DEPTH = 300_000;
/** Fire and torch particles stay visible through darkness without promoting mist/poison. */
export const LUMINOUS_SOURCE_PARTICLE_DEPTH = DARKNESS_OVERLAY_DEPTH + 0.2;

/**
 * Dynamic halos intentionally composite over every visible terrain row. Derive
 * that layer from the current view instead of a fixed world depth so reserved
 * room coordinates and an unbounded dungeon behave identically.
 */
export function lightOverlayDepth(view: ViewRect): number {
  const viewBottomTile = Math.ceil(
    (view.y + view.height) / SCREEN_TILE_PX,
  );
  const margin = LIGHTING_VISUAL_STYLE.streaming.overlayDepthMarginTiles;
  return Math.max(
    DARKNESS_OVERLAY_DEPTH,
    depthForOccluder(viewBottomTile + margin),
  );
}
