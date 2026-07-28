import {
  roomDoorWallAt,
  type RoomKind,
  type RoomWallSide,
} from "@dc2d/engine";
import type { ViewOrientation } from "../view/orientation/viewOrientation.js";
import { worldTileToView } from "../view/transform/viewTransform.js";

export interface RoomLocation {
  readonly kind: RoomKind;
  readonly cx: number;
  readonly cy: number;
}

export interface RoomDoorPosition {
  readonly x: number;
  readonly y: number;
}

export interface RoomDoorMount extends RoomDoorPosition {
  readonly wall: RoomWallSide;
  readonly anchor: { readonly x: number; readonly y: number };
}

export function roomDoorMount(
  room: RoomLocation,
  door: RoomDoorPosition,
): RoomDoorMount | null {
  const wall = roomDoorWallAt({ ...room, ...door });
  return wall ? { ...door, wall, anchor: wallAnchor(door, wall) } : null;
}

export function isRoomDoorScreenFacing(
  mount: RoomDoorMount,
  orientation: ViewOrientation,
): boolean {
  const door = worldTileToView(mount, orientation);
  const interior = worldTileToView(interiorTile(mount), orientation);
  return interior.x === door.x && interior.y === door.y + 1;
}

function wallAnchor(
  door: RoomDoorPosition,
  wall: RoomWallSide,
): { x: number; y: number } {
  switch (wall) {
    case "north": return { x: door.x + 0.5, y: door.y + 1 };
    case "south": return { x: door.x + 0.5, y: door.y };
    case "west": return { x: door.x + 1, y: door.y + 0.5 };
    case "east": return { x: door.x, y: door.y + 0.5 };
  }
}

function interiorTile(door: RoomDoorMount): RoomDoorPosition {
  switch (door.wall) {
    case "north": return { x: door.x, y: door.y + 1 };
    case "south": return { x: door.x, y: door.y - 1 };
    case "west": return { x: door.x + 1, y: door.y };
    case "east": return { x: door.x - 1, y: door.y };
  }
}
