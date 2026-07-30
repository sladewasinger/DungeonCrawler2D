import { biomeAtWorldTile } from "@dc2d/engine";
import type { Connection } from "../../../net/connection/connection.js";
import { resolveCompassLandmarks } from "../world/landmarks/compassLandmarks.js";
import { resolveStairwayTick } from "../world/stairwayTick.js";
import type { LiveHudSnapshot } from "./liveHudSnapshot.js";

interface LiveHudWorldFieldsRequest {
  readonly snapshot: LiveHudSnapshot;
  readonly conn: Connection;
  readonly body: { readonly x: number; readonly y: number };
  readonly compassBearingDeg: number;
}

export function updateLiveHudWorldFields(
  request: LiveHudWorldFieldsRequest,
): void {
  const { snapshot, conn, body, compassBearingDeg } = request;
  snapshot.biome = conn.world
    ? biomeAtWorldTile({
      worldSeed: conn.world.worldSeed,
      floor: conn.floor,
      wx: body.x,
      wy: body.y,
    }).biome
    : null;
  snapshot.stairway = conn.world
    ? resolveStairwayTick({
      world: conn.world,
      x: body.x,
      y: body.y,
      viewBearingDeg: compassBearingDeg,
    })
    : null;
  snapshot.compassLandmarks = conn.world
    ? resolveCompassLandmarks({
      world: conn.world,
      x: body.x,
      y: body.y,
      viewBearingDeg: compassBearingDeg,
      defeatedMiniBossArenaChunks: conn.defeatedMiniBossArenaChunks,
      miniBossArenaLandmarkRevision: conn.miniBossArenaLandmarkRevision,
    })
    : { safeRoom: null, miniBossArena: null };
}
