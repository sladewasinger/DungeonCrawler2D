import {
  FEATURE_FACE,
  TILE,
  type ServerSnapshot,
  type TileFeatureOverride,
} from "@dc2d/engine";
import type { Connection } from "../connection/connection.js";

export function applyWorldFeatureOverrides(
  conn: Connection,
  snapshot: ServerSnapshot,
): void {
  const arenaGates = (snapshot.miniBossArenaGates ?? []).map(openArenaGate);
  conn.world?.replaceFeatureOverrides([
    ...(snapshot.roomDoors ?? []),
    ...arenaGates,
  ]);
  conn.roomDoors = snapshot.roomDoors ?? [];
}

function openArenaGate(
  gate: NonNullable<ServerSnapshot["miniBossArenaGates"]>[number],
): TileFeatureOverride {
  return {
    ...gate,
    tile: TILE.Floor,
    featureFace: FEATURE_FACE.Top,
    featureHeight: 0,
  };
}
