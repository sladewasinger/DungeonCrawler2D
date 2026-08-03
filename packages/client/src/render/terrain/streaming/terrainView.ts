import { CHUNK_SIZE, isRoomIsolationChunk } from "@dc2d/engine";
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

export interface TerrainBoundsRequest {
  readonly view: ViewRect;
  readonly orientation: ViewOrientation;
  readonly profile: TerrainDeviceProfile;
  readonly finiteFloor?: boolean;
}

export function terrainBoundsForProfile(request: TerrainBoundsRequest): TerrainRect {
  const margin = request.finiteFloor === true
    ? request.profile.finiteTerrainMarginTiles
    : request.profile.terrainMarginTiles;
  return worldBoundsForView(request.view, request.orientation, margin);
}

export function terrainBoundsForWorld(
  request: TerrainBoundsRequest & { readonly finiteFloor: boolean },
): TerrainRect {
  const bounds = terrainBoundsForProfile(request);
  if (!request.finiteFloor || !isRoomIsolationView(bounds)) return bounds;
  return terrainBoundsForProfile({ ...request, finiteFloor: false });
}

export function clipTerrainBounds(
  bounds: TerrainRect,
  finiteBounds: TerrainWorldBounds | null | undefined,
  allowOutsideFinite = false,
): TerrainRect {
  if (!finiteBounds || allowOutsideFinite) return bounds;
  const x = Math.max(bounds.x, finiteBounds.minX);
  const y = Math.max(bounds.y, finiteBounds.minY);
  const maxX = Math.min(bounds.x + bounds.width, finiteBounds.maxX + 1);
  const maxY = Math.min(bounds.y + bounds.height, finiteBounds.maxY + 1);
  return { x, y, width: Math.max(0, maxX - x), height: Math.max(0, maxY - y) };
}

/** Legacy authored rooms live on an isolated plane outside finite floors. */
export function isRoomIsolationView(bounds: TerrainRect): boolean {
  const centerY = bounds.y + bounds.height / 2;
  return isRoomIsolationChunk(Math.floor(centerY / CHUNK_SIZE));
}

interface TerrainWorldBounds {
  readonly minX: number; readonly minY: number;
  readonly maxX: number; readonly maxY: number;
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
