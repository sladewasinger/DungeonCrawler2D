// World (continuous tile units) -> screen pixel conversion shared by every entity visual,
// plus the matching orientation-aware depth helper — the two placement primitives that,
// once routed through the seam, carry every entity/lighting/vfx call site (players,
// monsters, items, projectiles, torches, blood/corpse decals, area effects, melee
// wedges, nameplates, HP bars) along with them with no per-file changes needed.
// Reads the seam's ViewState directly (not a threaded parameter) for the same reason
// TerrainRenderer does — see viewState.ts's module doc.
import { depthForViewEntity } from "../view/viewDepth.js";
import { worldToView } from "../view/viewTransform.js";
import { getViewOrientation } from "../view/viewState.js";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";

export function worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
  const view = worldToView({ x: worldX, y: worldY }, getViewOrientation());
  return { x: view.x * SCREEN_TILE_PX, y: view.y * SCREEN_TILE_PX };
}

/** Phaser depth for an entity/decal with feet at (feetWorldX, feetWorldY), accounting
 * for the current view orientation — the drop-in replacement for depthSort.ts's
 * depthForEntity(feetWorldY, lift) at every call site that used it directly. */
export function depthForEntityNow(feetWorldX: number, feetWorldY: number, liftUnits = 0): number {
  return depthForViewEntity({ feetWorldX, feetWorldY, liftUnits }, getViewOrientation());
}
