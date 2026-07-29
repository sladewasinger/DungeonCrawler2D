import {
  CHUNK_SIZE,
  FEATURE_FACE,
} from "../../core/types.js";
import {
  PARTY_ROOM_H,
  PARTY_ROOM_W,
  SAFE_ROOM_H,
  SAFE_ROOM_W,
  type RoomKind,
} from "./roomModel.js";

export type RoomWallSide = "north" | "east" | "south" | "west";
export type WallFeatureFace =
  | typeof FEATURE_FACE.North
  | typeof FEATURE_FACE.East
  | typeof FEATURE_FACE.South
  | typeof FEATURE_FACE.West;

export interface RoomDoorPlacement {
  readonly x: number;
  readonly y: number;
  readonly wall: RoomWallSide;
  readonly featureFace: WallFeatureFace;
}

type LocalDoorPlacement = readonly [dx: number, dy: number, wall: RoomWallSide];

interface RoomDoorQuery {
  readonly kind: RoomKind;
  readonly cx: number;
  readonly cy: number;
  readonly x: number;
  readonly y: number;
}

interface WorldPlacementRequest {
  readonly cx: number;
  readonly cy: number;
  readonly width: number;
  readonly height: number;
  readonly placements: readonly LocalDoorPlacement[];
}

const SAFE_DOORS: readonly LocalDoorPlacement[] = [
  [8, 0, "north"], [10, 0, "north"], [12, 0, "north"], [14, 0, "north"],
  [16, 2, "east"], [16, 4, "east"], [16, 6, "east"], [16, 8, "east"],
  [14, 10, "south"], [12, 10, "south"], [10, 10, "south"],
  [6, 10, "south"], [4, 10, "south"], [2, 10, "south"],
  [0, 8, "west"], [0, 6, "west"], [0, 4, "west"], [0, 2, "west"],
  [2, 0, "north"], [4, 0, "north"],
];

const PARTY_DOORS: readonly LocalDoorPlacement[] = [
  [6, 0, "north"], [8, 0, "north"], [10, 0, "north"],
  [12, 0, "north"], [14, 0, "north"],
  [16, 3, "east"], [16, 5, "east"], [16, 7, "east"], [16, 9, "east"],
  [14, 12, "south"], [12, 12, "south"], [10, 12, "south"],
  [6, 12, "south"], [4, 12, "south"], [2, 12, "south"],
  [0, 9, "west"], [0, 7, "west"], [0, 5, "west"], [0, 3, "west"],
  [2, 0, "north"],
];

export function safeRoomDoorPlacements(cx: number, cy: number): RoomDoorPlacement[] {
  return worldPlacements({ cx, cy, width: SAFE_ROOM_W, height: SAFE_ROOM_H, placements: SAFE_DOORS });
}

export function partyRoomDoorPlacements(cx: number, cy: number): RoomDoorPlacement[] {
  return worldPlacements({ cx, cy, width: PARTY_ROOM_W, height: PARTY_ROOM_H, placements: PARTY_DOORS });
}

export function roomDoorWallAt(query: RoomDoorQuery): RoomWallSide | null {
  const { kind, cx, cy, x, y } = query;
  const placements = kind === "safe"
    ? safeRoomDoorPlacements(cx, cy)
    : kind === "party" ? partyRoomDoorPlacements(cx, cy) : [];
  return placements.find((door) => door.x === x && door.y === y)?.wall ?? null;
}

function worldPlacements(request: WorldPlacementRequest): RoomDoorPlacement[] {
  const { cx, cy, width, height, placements } = request;
  const left = Math.floor(CHUNK_SIZE / 2 - width / 2);
  const top = Math.floor(CHUNK_SIZE / 2 - height / 2);
  return placements.map(([dx, dy, wall]) => ({
    x: cx * CHUNK_SIZE + left + dx,
    y: cy * CHUNK_SIZE + top + dy,
    wall,
    featureFace: wallFeatureFace(wall),
  }));
}

function wallFeatureFace(wall: RoomWallSide): WallFeatureFace {
  return {
    north: FEATURE_FACE.South,
    east: FEATURE_FACE.West,
    south: FEATURE_FACE.North,
    west: FEATURE_FACE.East,
  }[wall];
}
