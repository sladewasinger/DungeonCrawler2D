import { SCREEN_TILE_PX } from "../../../boot/assetManifest.js";
import type { ViewOrientation } from "../../view/orientation/viewOrientation.js";
import {
  viewToWorld,
  worldToView,
} from "../../view/transform/viewTransform.js";
import type { ViewRect } from "./streaming.js";
import type { TerrainDeviceProfile } from "./terrainDeviceProfile.js";
import type { TerrainRect } from "../planning/terrainPlanner.js";
import { worldBoundsForView } from "../runtime/renderSupport.js";

export function terrainBoundsForProfile(
  view: ViewRect,
  orientation: ViewOrientation,
  profile: TerrainDeviceProfile,
): TerrainRect {
  return worldBoundsForView(view, orientation, profile.terrainMarginTiles);
}

export function rotatedTerrainView(
  view: ViewRect,
  current: ViewOrientation,
  next: ViewOrientation,
): ViewRect {
  const centerView = {
    x: (view.x + view.width / 2) / SCREEN_TILE_PX,
    y: (view.y + view.height / 2) / SCREEN_TILE_PX,
  };
  const center = worldToView(viewToWorld(centerView, current), next);
  return {
    x: center.x * SCREEN_TILE_PX - view.width / 2,
    y: center.y * SCREEN_TILE_PX - view.height / 2,
    width: view.width,
    height: view.height,
  };
}
