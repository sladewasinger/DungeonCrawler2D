import { CHUNK_SIZE, FEATURE_FACE } from "../../core/types.js";
import {
  SPAWN_ROOM_H,
  SPAWN_ROOM_W,
  ROOM_REGION_CY,
  type RoomSlot,
} from "./roomModel.js";
import {
  ROOM_WALL_RISE,
  SOUTH_EXIT_HALL_DEPTH,
} from "./roomExitGeometry.js";
import type { WallFeatureFace } from "./roomDoorPlacements.js";

const SPAWN_ROOM_SLOT_COUNT = 21;
const SPAWN_ROOM_COLUMNS = 7;

/** Shared entry room, isolated one AOI stride west of private room slots. */
export const SPAWN_ROOM_CHUNK = { cx: -2, cy: ROOM_REGION_CY } as const;

export function spawnRoomChunk(): { cx: number; cy: number } {
  return { ...SPAWN_ROOM_CHUNK };
}

export function spawnRoomSlotAt(cx: number, cy: number): RoomSlot | null {
  if (cx !== SPAWN_ROOM_CHUNK.cx || cy !== SPAWN_ROOM_CHUNK.cy) return null;
  return { kind: "spawn", w: SPAWN_ROOM_W, h: SPAWN_ROOM_H };
}

/** Spreads concurrent entrants through a central 7×3 grid. */
export function spawnRoomSpawn(slot = 0): { x: number; y: number } {
  const center = spawnRoomCenter();
  const normalized = Math.abs(Math.trunc(slot)) % SPAWN_ROOM_SLOT_COUNT;
  const column = normalized % SPAWN_ROOM_COLUMNS;
  const row = Math.floor(normalized / SPAWN_ROOM_COLUMNS);
  return {
    x: center.x + (column - 3) * 2 + 0.5,
    y: center.y + (row - 1) * 2 + 0.5,
  };
}

/** Center of the north wall, halfway up its visible face. */
export function spawnRoomSpeakerPosition(): { x: number; y: number; z: number } {
  const center = spawnRoomCenter();
  const top = Math.floor(CHUNK_SIZE / 2 - SPAWN_ROOM_H / 2);
  return {
    x: center.x + 0.5,
    y: SPAWN_ROOM_CHUNK.cy * CHUNK_SIZE + top + 0.5,
    z: ROOM_WALL_RISE / 2,
  };
}

export function spawnRoomFeatures(): {
  exit: { x: number; y: number; featureFace: WallFeatureFace };
} {
  const top = Math.floor(CHUNK_SIZE / 2 - SPAWN_ROOM_H / 2);
  const wallY = SPAWN_ROOM_CHUNK.cy * CHUNK_SIZE + top + SPAWN_ROOM_H - 1;
  return {
    exit: {
      x: SPAWN_ROOM_CHUNK.cx * CHUNK_SIZE + Math.floor(CHUNK_SIZE / 2),
      y: wallY + SOUTH_EXIT_HALL_DEPTH,
      featureFace: FEATURE_FACE.North,
    },
  };
}

function spawnRoomCenter(): { x: number; y: number } {
  return {
    x: SPAWN_ROOM_CHUNK.cx * CHUNK_SIZE + CHUNK_SIZE / 2,
    y: SPAWN_ROOM_CHUNK.cy * CHUNK_SIZE + CHUNK_SIZE / 2,
  };
}
