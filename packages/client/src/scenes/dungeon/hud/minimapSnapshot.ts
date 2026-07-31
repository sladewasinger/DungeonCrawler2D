import type { World } from "@dc2d/engine";
import type { Connection } from "../../../net/connection/connection.js";
import type {
  MinimapSnapshot,
} from "../../../ui/hud/model/minimap/minimapTypes.js";
import { resolveMinimapEntityMarkers } from "./minimap/minimapEntityMarkers.js";
import { resolveMinimapLandmarks } from "./minimap/minimapLandmarkMarkers.js";
import { cachedMinimapTerrain, MINIMAP_RANGE_TILES } from "./minimap/minimapTerrainCache.js";

export interface MinimapSnapshotRequest {
  readonly connection: Connection;
  readonly world: World | null;
  readonly centerX: number;
  readonly centerY: number;
}

export function buildMinimapSnapshot(
  request: MinimapSnapshotRequest,
): MinimapSnapshot {
  const { connection, world, centerX, centerY } = request;
  return {
    centerX,
    centerY,
    rangeTiles: MINIMAP_RANGE_TILES,
    terrain: cachedMinimapTerrain(world, centerX, centerY),
    entities: resolveMinimapEntityMarkers(connection),
    landmarks: resolveMinimapLandmarks({ connection, world, centerX, centerY }),
  };
}
