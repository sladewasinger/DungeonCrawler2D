import { describe, expect, it } from "vitest";
import { WALL_DOOR_FEATURE_HEIGHT } from "../../../core/constants.js";
import {
  CHUNK_SIZE,
  FEATURE_FACE,
  TERRAIN,
  TILE,
  ZONE,
} from "../../core/types.js";
import { ROOM_WALL_RISE, SOUTH_EXIT_HALL_DEPTH } from "./roomExitGeometry.js";
import {
  PARTY_ROOM_H,
  PARTY_ROOM_W,
  PERSONAL_ROOM_H,
  PERSONAL_ROOM_W,
  SAFE_ROOM_H,
  SAFE_ROOM_W,
  type RoomKind,
} from "./roomModel.js";
import { generateRoomChunk } from "./roomChunkBuilder.js";
import { partyRoomChunk, personalRoomChunk, safeRoomChunk } from "./rooms.js";

interface RoomCase {
  readonly kind: RoomKind;
  readonly position: { readonly cx: number; readonly cy: number };
  readonly width: number;
  readonly height: number;
}

const CASES: readonly RoomCase[] = [
  { kind: "personal", position: personalRoomChunk(0), width: PERSONAL_ROOM_W, height: PERSONAL_ROOM_H },
  { kind: "party", position: partyRoomChunk(0), width: PARTY_ROOM_W, height: PARTY_ROOM_H },
  { kind: "safe", position: safeRoomChunk(4, 7), width: SAFE_ROOM_W, height: SAFE_ROOM_H },
];

describe("room chunks with VOID terrain disabled", () => {
  it.each(CASES)("preserves the legacy finite $kind room cell-for-cell", (room) => {
    const chunk = generateRoomChunk(room.position.cx, room.position.cy, false);
    for (let index = 0; index < chunk.tiles.length; index++) {
      assertFiniteCell(chunk, room, index);
    }
  });
});

function assertFiniteCell(
  chunk: ReturnType<typeof generateRoomChunk>,
  room: RoomCase,
  index: number,
): void {
  const lx = index % CHUNK_SIZE;
  const ly = Math.floor(index / CHUNK_SIZE);
  const geometry = cellGeometry(room, lx, ly);
  const feature = expectedTile(room, lx, ly);
  expect(chunk.tiles[index], `tile ${index}`).toBe(TILE.Floor);
  expect(chunk.terrain[index], `terrain ${index}`).toBe(TERRAIN.Floor);
  expect(chunk.features[index], `feature ${index}`).toBe(feature);
  expect(chunk.featureFaces[index], `feature face ${index}`)
    .toBe(feature === TILE.DoorExit ? FEATURE_FACE.North : FEATURE_FACE.Top);
  expect(chunk.featureHeight[index], `feature height ${index}`)
    .toBe(feature === TILE.DoorExit ? WALL_DOOR_FEATURE_HEIGHT : 0);
  expect(chunk.height[index], `height ${index}`).toBe(geometry.ground ? 0 : ROOM_WALL_RISE);
  expect(chunk.zones[index], `zone ${index}`).toBe(geometry.sanctuary ? ZONE.Sanctuary : ZONE.None);
}

function cellGeometry(
  room: RoomCase,
  lx: number,
  ly: number,
): { readonly ground: boolean; readonly sanctuary: boolean } {
  const rect = roomRect(room);
  const inRoom = within(lx, rect.left, room.width) && within(ly, rect.top, room.height);
  const inInterior = within(lx, rect.left + 1, room.width - 2) &&
    within(ly, rect.top + 1, room.height - 2);
  const inHall = lx === rect.centerX &&
    within(ly, rect.top + room.height - 1, SOUTH_EXIT_HALL_DEPTH);
  return { ground: inInterior || inHall, sanctuary: inRoom || inHall };
}

function expectedTile(room: RoomCase, lx: number, ly: number): number {
  const rect = roomRect(room);
  const exitY = rect.top + room.height - 1 + SOUTH_EXIT_HALL_DEPTH;
  if (lx === rect.centerX && ly === exitY) return TILE.DoorExit;
  if (room.kind !== "personal" || ly !== rect.top + 1) return TILE.Floor;
  if (lx === rect.left + 1) return TILE.Stash;
  return lx === rect.left + room.width - 2 ? TILE.CraftingTable : TILE.Floor;
}

function roomRect(room: RoomCase): { readonly left: number; readonly top: number; readonly centerX: number } {
  return {
    left: Math.floor(CHUNK_SIZE / 2 - room.width / 2),
    top: Math.floor(CHUNK_SIZE / 2 - room.height / 2),
    centerX: Math.floor(CHUNK_SIZE / 2),
  };
}

function within(value: number, start: number, length: number): boolean {
  return value >= start && value < start + length;
}
