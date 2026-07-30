import type { AreaTileUpdate, ServerSnapshot } from "@dc2d/engine";
import type { Connection } from "../connection/connection.js";
import { recordSample } from "../interpolation/interpolate.js";
import { pruneAreaTiles } from "./areaTiles/areaTileRetention.js";

/** Synchronizes remote presentation state from one authoritative snapshot. */
export function applyRemoteState(
  conn: Connection,
  snap: ServerSnapshot,
  arrivalMs: number,
): void {
  const serverTime = conn.serverTimeline.observe(snap.tick, arrivalMs);
  conn.interpolationDelay.observe(snap.tick, arrivalMs);
  for (const entity of snap.entities) applyEntitySample(conn, serverTime, entity);
  for (const tile of snap.areas) applyAreaTile(conn, tile);
  pruneAreaTiles({
    areaTiles: conn.areaTiles,
    areaTileLayers: conn.areaTileLayers,
    centerX: snap.self.x,
    centerY: snap.self.y,
  });
}

function applyEntitySample(
  conn: Connection,
  now: number,
  entity: ServerSnapshot["entities"][number],
): void {
  let remote = conn.entities.get(entity.id);
  if (!remote) {
    remote = { snap: entity, samples: [] };
    conn.entities.set(entity.id, remote);
  }
  recordSample(remote, now, entity);
}

function applyAreaTile(conn: Connection, tile: AreaTileUpdate): void {
  const key = `${tile.x},${tile.y}`;
  if (tile.defId === null) {
    conn.areaTiles.delete(key);
    conn.areaTileLayers.delete(key);
    return;
  }
  conn.areaTiles.set(key, tile.defId);
  if (tile.layers) conn.areaTileLayers.set(key, tile.layers);
  else conn.areaTileLayers.delete(key);
}
