import {
  CHUNK_SIZE,
  FEATURE_FACE,
} from "../../core/types.js";
import {
  PERSONAL_ROOM_H,
  PERSONAL_ROOM_W,
  SAFE_ROOM_H,
} from "./roomModel.js";
import {
  partyRoomDoorPlacements,
  safeRoomDoorPlacements,
  type WallFeatureFace,
} from "./roomDoorPlacements.js";
import { southExitDoorY } from "./roomExitGeometry.js";
import {
  personalRoomChunk,
  roomKindAt,
  safeRoomChunk,
} from "./locations/roomLocations.js";

export { generateRoomChunk } from "./roomChunkBuilder.js";
export * from "./roomDoorPlacements.js";
export * from "./roomExitGeometry.js";
export * from "./locations/roomLocations.js";
export * from "./roomModel.js";
export * from "./spawnRoom.js";

/**
 * Stretch rooms (GAME_DESIGN.md § Safe rooms): instanced sub-maps that
 * safe-room doors teleport into. They live in a reserved chunk band far
 * from the playable floor — deterministic geometry, so client and
 * server generate identical rooms; *identity* (who may enter) is
 * enforced server-side via teleports, and rooms are spaced further
 * apart than the AOI radius, so neighbors never replicate.
 */

/** World tile coords of a safe room's fixtures (tests, UI hints). */
export function safeRoomFeatures(doorCx: number, doorCy: number): {
  doors: Array<{ x: number; y: number; featureFace: WallFeatureFace }>;
  exit: { x: number; y: number; featureFace: WallFeatureFace };
} {
  const chunk = safeRoomChunk(doorCx, doorCy);
  const baseX = chunk.cx * CHUNK_SIZE;
  const baseY = chunk.cy * CHUNK_SIZE;
  const top = Math.floor(CHUNK_SIZE / 2 - SAFE_ROOM_H / 2);
  const centerX = baseX + Math.floor(CHUNK_SIZE / 2);
  return {
    doors: safeRoomDoorPlacements(chunk.cx, chunk.cy)
      .map(({ x, y, featureFace }) => ({ x, y, featureFace })),
    exit: {
      x: centerX,
      y: southExitDoorY(baseY, top, SAFE_ROOM_H),
      featureFace: FEATURE_FACE.North,
    },
  };
}

/** World tile coords of a personal room's fixtures (tests, UI hints). */
export function personalRoomFeatures(slot: number): {
  stash: { x: number; y: number };
  table: { x: number; y: number };
  exit: { x: number; y: number; featureFace: WallFeatureFace };
} {
  const chunk = personalRoomChunk(slot);
  const baseX = chunk.cx * CHUNK_SIZE;
  const baseY = chunk.cy * CHUNK_SIZE;
  const left = Math.floor(CHUNK_SIZE / 2 - PERSONAL_ROOM_W / 2);
  const top = Math.floor(CHUNK_SIZE / 2 - PERSONAL_ROOM_H / 2);
  return {
    stash: { x: baseX + left + 1, y: baseY + top + 1 },
    table: { x: baseX + left + PERSONAL_ROOM_W - 2, y: baseY + top + 1 },
    exit: {
      x: baseX + Math.floor(CHUNK_SIZE / 2),
      y: southExitDoorY(baseY, top, PERSONAL_ROOM_H),
      featureFace: FEATURE_FACE.North,
    },
  };
}

/** Twenty clockwise portal positions, beginning at the north-wall center. */
export function safeRoomDoorPositions(
  cx: number,
  cy: number,
): Array<{ x: number; y: number; featureFace: WallFeatureFace }> {
  if (roomKindAt(cx, cy) !== "safe") return [];
  return safeRoomDoorPlacements(cx, cy)
    .map(({ x, y, featureFace }) => ({ x, y, featureFace }));
}

/** One private personal-room portal site per possible party member. */
export function partyRoomDoorPositions(
  cx: number,
  cy: number,
): Array<{ x: number; y: number; featureFace: WallFeatureFace }> {
  if (roomKindAt(cx, cy) !== "party") return [];
  return partyRoomDoorPlacements(cx, cy)
    .map(({ x, y, featureFace }) => ({ x, y, featureFace }));
}
