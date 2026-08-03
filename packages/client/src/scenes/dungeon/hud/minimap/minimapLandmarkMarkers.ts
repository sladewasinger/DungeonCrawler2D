import type { World } from "@dc2d/engine";
import type { Connection } from "../../../../net/connection/connection.js";
import { resolveCompassLandmarkPositions } from "../../world/landmarks/compassLandmarks.js";
import type { MinimapLandmarkMarker } from "../../../../ui/hud/model/minimap/minimapTypes.js";

interface LandmarkRequest {
  readonly connection: Connection;
  readonly world: World | null;
  readonly centerX: number;
  readonly centerY: number;
}

export const resolveMinimapLandmarks = ({
  connection,
  world,
  centerX,
  centerY,
}: LandmarkRequest): MinimapLandmarkMarker[] => {
  if (!world) return [];
  const markers = compassLandmarks({ connection, world, centerX, centerY });
  for (const stairs of world.downStairwayPositions()) {
    markers.push({ kind: "stairs", x: stairs.x, y: stairs.y });
  }
  return markers;
};

const compassLandmarks = ({
  connection,
  world,
  centerX,
  centerY,
}: LandmarkRequest & { readonly world: World }): MinimapLandmarkMarker[] => {
  const positions = resolveCompassLandmarkPositions({
    world,
    x: centerX,
    y: centerY,
    viewBearingDeg: 0,
    defeatedMiniBossArenaChunks: connection.defeatedMiniBossArenaChunks,
    ...(connection.defeatedMiniBossArenaWindowCenter
      ? { miniBossArenaWindowCenter: connection.defeatedMiniBossArenaWindowCenter }
      : {}),
    miniBossArenaLandmarkRevision: connection.miniBossArenaLandmarkRevision,
  });
  const markers: MinimapLandmarkMarker[] = [];
  if (positions.safeRoom) markers.push({ kind: "safeRoom", ...positions.safeRoom });
  if (positions.miniBossArena) markers.push({ kind: "miniBossArena", ...positions.miniBossArena });
  return markers;
};
