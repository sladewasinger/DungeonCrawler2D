import {
  CHUNK_SIZE,
  FEATURE_FACE,
  type FeatureFace,
} from "../../../core/types.js";
import { ROOM_TUNING } from "../roomConfiguration/roomTuning.js";

export const SPAWN_ROOM_EXTERIOR_TUNING = ROOM_TUNING.spawn.exterior;
const EXTERIOR = SPAWN_ROOM_EXTERIOR_TUNING;

export const SPAWN_ROOM_EXTERIOR_DOOR = Object.freeze({
  x: EXTERIOR.chunkX * CHUNK_SIZE + EXTERIOR.centerTileX,
  y: EXTERIOR.chunkY * CHUNK_SIZE + EXTERIOR.southWallTileY,
  featureFace: FEATURE_FACE.South,
});

export interface SpawnRoomExteriorSite {
  readonly door: {
    readonly x: number;
    readonly y: number;
    readonly featureFace: FeatureFace;
  };
  readonly landingPositions: readonly {
    readonly x: number;
    readonly y: number;
  }[];
}

interface ExteriorRegion {
  readonly floor: number;
  readonly cx: number;
  readonly cy: number;
  readonly rect: {
    readonly x0: number;
    readonly y0: number;
    readonly x1: number;
    readonly y1: number;
  };
}

/** Dungeon-side facade and ordered exit positions for the reserved spawn room. */
export function spawnRoomExteriorSite(): SpawnRoomExteriorSite {
  return {
    door: SPAWN_ROOM_EXTERIOR_DOOR,
    landingPositions: exteriorLandingPositions(),
  };
}

export function isSpawnRoomExteriorDoor(
  floor: number,
  x: number,
  y: number,
): boolean {
  return floor === EXTERIOR.floor &&
    x === SPAWN_ROOM_EXTERIOR_DOOR.x &&
    y === SPAWN_ROOM_EXTERIOR_DOOR.y;
}

export function overlapsSpawnRoomExterior(region: ExteriorRegion): boolean {
  if (region.floor !== EXTERIOR.floor) return false;
  const chunkX = region.cx * CHUNK_SIZE;
  const chunkY = region.cy * CHUNK_SIZE;
  const rect = {
    x0: chunkX + region.rect.x0,
    y0: chunkY + region.rect.y0,
    x1: chunkX + region.rect.x1,
    y1: chunkY + region.rect.y1,
  };
  const halfWidth = Math.floor(EXTERIOR.width / 2);
  return rect.x0 <= SPAWN_ROOM_EXTERIOR_DOOR.x + halfWidth &&
    rect.x1 >= SPAWN_ROOM_EXTERIOR_DOOR.x - halfWidth &&
    rect.y0 <= SPAWN_ROOM_EXTERIOR_DOOR.y + EXTERIOR.apronDepth &&
    rect.y1 >= SPAWN_ROOM_EXTERIOR_DOOR.y - EXTERIOR.depth + 1;
}

function exteriorLandingPositions(): readonly { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  for (let depth = 1; depth <= EXTERIOR.apronDepth; depth++) {
    for (const offset of centeredOffsets(EXTERIOR.apronHalfWidth)) {
      positions.push({
        x: SPAWN_ROOM_EXTERIOR_DOOR.x + offset + 0.5,
        y: SPAWN_ROOM_EXTERIOR_DOOR.y + depth + 0.5,
      });
    }
  }
  return positions;
}

function centeredOffsets(radius: number): number[] {
  const offsets = [0];
  for (let distance = 1; distance <= radius; distance++) {
    offsets.push(-distance, distance);
  }
  return offsets;
}
