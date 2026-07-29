// World (continuous tile units) -> screen pixel conversion shared by every entity visual,
// plus the matching orientation-aware depth helper — the two placement primitives that,
// once routed through the seam, carry every entity/lighting/vfx call site (players,
// monsters, items, projectiles, torches, blood/corpse decals, area effects, melee
// wedges, nameplates, HP bars) along with them with no per-file changes needed.
// Reads the seam's ViewState directly (not a threaded parameter) for the same reason
// TerrainRenderer does — see viewState.ts's module doc.
import type { WorldView } from "@dc2d/engine";
import { depthForViewEntity } from "../../view/transform/viewDepth.js";
import { depthForEntity } from "../presentation/depthSort.js";
import { viewTileToWorld, worldToView } from "../../view/transform/viewTransform.js";
import { getViewOrientation } from "../../view/transform/viewState.js";
import { SCREEN_TILE_PX } from "../../../boot/assetManifest.js";
import { spriteLiftPx } from "../motion/lift.js";

export function worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
  const view = worldToView({ x: worldX, y: worldY }, getViewOrientation());
  return { x: view.x * SCREEN_TILE_PX, y: view.y * SCREEN_TILE_PX };
}

/** Screen position of a point on a ground surface at absolute height `groundHeight`. */
export function groundToScreen(worldX: number, worldY: number, groundHeight: number): { x: number; y: number } {
  const screen = worldToScreen(worldX, worldY);
  return { x: screen.x, y: screen.y - spriteLiftPx(groundHeight) };
}

/** Phaser depth for an entity/decal with feet at (feetWorldX, feetWorldY), accounting
 * for the current view orientation — the drop-in replacement for depthSort.ts's
 * depthForEntity(feetWorldY, lift) at every call site that used it directly. */
export function depthForEntityNow(feetWorldX: number, feetWorldY: number, liftUnits = 0): number {
  return depthForViewEntity({ feetWorldX, feetWorldY, liftUnits }, getViewOrientation());
}

/** Depth for a screen-space attachment point. Unlike an entity's feet row, this
 * follows the point's actual projected Y, including negative-Z pit displacement. */
export function depthForScreenY(screenY: number): number {
  return depthForEntity(screenY / SCREEN_TILE_PX);
}

export interface CombatOverlayPosition {
  readonly wielderViewY: number;
  readonly screenSouthFloorHigher: boolean;
}

/** Samples the immediate screen-south floor for combat overlays that share the player's terrain ordering. */
export interface CombatOverlayPositionInput {
  readonly worldX: number;
  readonly worldY: number;
  readonly z: number;
  readonly world: WorldView;
}

export function combatOverlayPosition({
  worldX,
  worldY,
  z,
  world,
}: CombatOverlayPositionInput): CombatOverlayPosition {
  const orientation = getViewOrientation();
  const viewPosition = worldToView({ x: worldX, y: worldY }, orientation);
  const southWorld = viewTileToWorld({ x: Math.floor(viewPosition.x), y: Math.floor(viewPosition.y) + 1 }, orientation);
  return {
    wielderViewY: viewPosition.y,
    screenSouthFloorHigher: world.isWalkable(southWorld.x, southWorld.y) && world.heightAt(southWorld.x, southWorld.y) > z + 0.01,
  };
}
