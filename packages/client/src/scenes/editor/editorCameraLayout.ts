import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { islandViewCentroid } from "../../render/terrain/islandChunk.js";
import type { ViewOrientation } from "../../render/view/index.js";
import { EDITOR_GRID_SIZE } from "./EditableWorld.js";

export interface EditorCameraLayout {
  readonly centerX: number;
  readonly centerY: number;
  readonly zoom: number;
}

export function editorCameraLayout(orientation: ViewOrientation): EditorCameraLayout {
  const centroid = islandViewCentroid(orientation, EDITOR_GRID_SIZE);
  return {
    centerX: centroid.x * SCREEN_TILE_PX,
    centerY: centroid.y * SCREEN_TILE_PX,
    zoom: 1,
  };
}
