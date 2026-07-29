import { WALL_DOOR_FEATURE_HEIGHT } from "../../../../core/constants.js";
import { FEATURE_FACE, TILE, TOPOLOGY } from "../../../core/types.js";
import {
  SPAWN_ROOM_EXTERIOR_DOOR,
  SPAWN_ROOM_EXTERIOR_TUNING,
} from "./spawnRoomExterior.js";

const EXTERIOR = SPAWN_ROOM_EXTERIOR_TUNING;

export interface SpawnRoomExteriorStamp {
  readonly floor: number;
  readonly voidTerrain: boolean;
  readonly originWorldX: number;
  readonly originWorldY: number;
  readonly size: number;
  readonly tiles: Uint8Array;
  readonly featureTiles: Uint8Array;
  readonly featureFaces: Uint8Array;
  readonly featureHeight: Float32Array;
  readonly height: Float32Array;
  readonly corridorCarved: Uint8Array;
}

export interface SpawnRoomExteriorPlacement {
  readonly approach: { readonly x: number; readonly y: number };
  readonly frontY: number;
}

/** Stamps the visible dungeon-side building after ordinary authored features. */
export function applySpawnRoomExterior(
  context: SpawnRoomExteriorStamp,
): SpawnRoomExteriorPlacement | null {
  const door = localExteriorDoor(context);
  if (!door) return null;
  stampExteriorBuilding(context, door);
  stampExteriorApron(context, door);
  stampExteriorDoor(context, door);
  return {
    approach: {
      x: door.x,
      y: door.y + EXTERIOR.apronDepth,
    },
    frontY: door.y + 1,
  };
}

function localExteriorDoor(
  context: SpawnRoomExteriorStamp,
): { x: number; y: number } | null {
  if (context.floor !== EXTERIOR.floor) return null;
  const door = {
    x: SPAWN_ROOM_EXTERIOR_DOOR.x - context.originWorldX,
    y: SPAWN_ROOM_EXTERIOR_DOOR.y - context.originWorldY,
  };
  return exteriorFitsGrid(door, context.size) ? door : null;
}

function exteriorFitsGrid(
  door: { readonly x: number; readonly y: number },
  size: number,
): boolean {
  const halfWidth = Math.floor(EXTERIOR.width / 2);
  return door.x - halfWidth >= 0 &&
    door.x + halfWidth < size &&
    door.y - EXTERIOR.depth + 1 >= 0 &&
    door.y + EXTERIOR.apronDepth < size;
}

function stampExteriorBuilding(
  context: SpawnRoomExteriorStamp,
  door: { readonly x: number; readonly y: number },
): void {
  const halfWidth = Math.floor(EXTERIOR.width / 2);
  for (let y = door.y - EXTERIOR.depth + 1; y <= door.y; y++) {
    for (let x = door.x - halfWidth; x <= door.x + halfWidth; x++) {
      stampSurface(context, {
        x,
        y,
        tile: context.voidTerrain ? TOPOLOGY.Uncarved : TILE.Bedrock,
        height: EXTERIOR.wallHeight,
        corridor: false,
      });
    }
  }
}

function stampExteriorApron(
  context: SpawnRoomExteriorStamp,
  door: { readonly x: number; readonly y: number },
): void {
  for (let y = door.y + 1; y <= door.y + EXTERIOR.apronDepth; y++) {
    for (let dx = -EXTERIOR.apronHalfWidth;
      dx <= EXTERIOR.apronHalfWidth; dx++) {
      stampSurface(context, {
        x: door.x + dx,
        y,
        tile: TILE.Floor,
        height: 0,
        corridor: true,
      });
    }
  }
}

interface SurfaceStamp {
  readonly x: number;
  readonly y: number;
  readonly tile: number;
  readonly height: number;
  readonly corridor: boolean;
}

function stampSurface(
  context: SpawnRoomExteriorStamp,
  stamp: SurfaceStamp,
): void {
  const index = stamp.y * context.size + stamp.x;
  clearFeature(context, index);
  context.tiles[index] = stamp.tile;
  context.height[index] = stamp.height;
  if (stamp.corridor) context.corridorCarved[index] = 1;
}

function clearFeature(
  context: SpawnRoomExteriorStamp,
  index: number,
): void {
  context.featureTiles[index] = TILE.Floor;
  context.featureFaces[index] = FEATURE_FACE.Top;
  context.featureHeight[index] = 0;
}

function stampExteriorDoor(
  context: SpawnRoomExteriorStamp,
  door: { readonly x: number; readonly y: number },
): void {
  const index = door.y * context.size + door.x;
  context.featureTiles[index] = TILE.DoorExit;
  context.featureFaces[index] = FEATURE_FACE.South;
  context.featureHeight[index] = WALL_DOOR_FEATURE_HEIGHT;
}
