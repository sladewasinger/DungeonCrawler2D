import {
  CHUNK_SIZE,
  safeRoomEntranceDoorForChunk,
  type World,
} from "@dc2d/engine";
import { nearestLandmark } from "./compassLandmarkMath.js";
import type { CompassLandmarkPosition } from "./compassLandmarkTypes.js";

const SAFE_ROOM_SEARCH_RADIUS_CHUNKS = 2;

export function nearestSafeRoomEntrance(
  world: World,
  x: number,
  y: number,
): CompassLandmarkPosition | null {
  const candidates = squareChunks(x, y).flatMap(({ cx, cy }) =>
    safeRoomEntrance(world, cx, cy));
  return nearestLandmark({ positions: candidates, x, y });
}

function squareChunks(
  x: number,
  y: number,
): Array<{ readonly cx: number; readonly cy: number }> {
  const centerX = Math.floor(x / CHUNK_SIZE);
  const centerY = Math.floor(y / CHUNK_SIZE);
  const radius = SAFE_ROOM_SEARCH_RADIUS_CHUNKS;
  return Array.from({ length: 2 * radius + 1 }, (_, xOffset) =>
    Array.from({ length: 2 * radius + 1 }, (_, yOffset) => ({
      cx: centerX + xOffset - radius,
      cy: centerY + yOffset - radius,
    })),
  ).flat();
}

function safeRoomEntrance(
  world: World,
  cx: number,
  cy: number,
): CompassLandmarkPosition[] {
  const chunk = { worldSeed: world.worldSeed, floor: world.floor, cx, cy };
  const door = safeRoomEntranceDoorForChunk(chunk);
  return door ? [{ x: door.x + 0.5, y: door.y + 0.5 }] : [];
}
