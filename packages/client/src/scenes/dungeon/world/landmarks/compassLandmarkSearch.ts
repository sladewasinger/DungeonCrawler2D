import { nearestMiniBossArena } from "./miniBossCompassSearch.js";
import { nearestSafeRoomEntrance } from "./safeRoomCompassSearch.js";
import type {
  CompassLandmarkPositions,
  CompassLandmarkSearchRequest,
} from "./compassLandmarkTypes.js";

export type {
  CompassLandmarkPosition,
  CompassLandmarkPositions,
  CompassLandmarkSearchRequest,
} from "./compassLandmarkTypes.js";

export function findNearestCompassLandmarks(
  request: CompassLandmarkSearchRequest,
): CompassLandmarkPositions {
  const { world, x, y } = request;
  return {
    safeRoom: nearestSafeRoomEntrance(world, x, y),
    miniBossArena: nearestMiniBossArena({
      world,
      x,
      y,
      ...(request.defeatedMiniBossArenaChunks
        ? { defeatedArenaChunks: request.defeatedMiniBossArenaChunks }
        : {}),
    }),
  };
}
