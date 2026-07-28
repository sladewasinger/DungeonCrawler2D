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
  generateRoomChunk,
  partyRoomChunk,
  personalRoomChunk,
  personalRoomFeatures,
  personalRoomSpawn,
  safeRoomChunk,
} from "./rooms.js";

const tileAt = (
  chunk: ReturnType<typeof generateRoomChunk>,
  wx: number,
  wy: number,
): number => {
  const lx = wx - chunk.cx * CHUNK_SIZE;
  const ly = wy - chunk.cy * CHUNK_SIZE;
  const index = ly * CHUNK_SIZE + lx;
  return chunk.features[index] || chunk.tiles[index] || TILE.Floor;
};

const within = (value: number, start: number, length: number): boolean =>
  value >= start && value < start + length;

function isCarvedRoomCell(input: { lx: number; ly: number; room: RoomCase }): boolean {
  const { lx, ly, room } = input;
  const top = Math.floor(CHUNK_SIZE / 2 - room.height / 2);
  const bottom = top + room.height - 1;
  const left = Math.floor(CHUNK_SIZE / 2 - room.width / 2);
  const centerLx = Math.floor(CHUNK_SIZE / 2);
  const inBackWall = within(lx, left, room.width) && ly === top;
  const inInterior = within(lx, left + 1, room.width - 2) &&
    within(ly, top + 1, room.height - 2);
  const inHall = lx === centerLx && within(ly, bottom, SOUTH_EXIT_HALL_DEPTH);
  return inBackWall || inInterior || inHall;
}

function assertCarvedMask(chunk: ReturnType<typeof generateRoomChunk>, room: RoomCase): void {
  const top = Math.floor(CHUNK_SIZE / 2 - room.height / 2);
  for (let index = 0; index < chunk.terrain.length; index++) assertRoomCell({ chunk, room, top, index });
}

function assertRoomCell(input: {
  chunk: ReturnType<typeof generateRoomChunk>;
  room: RoomCase;
  top: number;
  index: number;
}): void {
  const { chunk, room, top, index } = input;
  const lx = index % CHUNK_SIZE;
  const ly = Math.floor(index / CHUNK_SIZE);
  const expectedTile = expectedRoomTile({ lx, ly, room });
  if (!isCarvedRoomCell({ lx, ly, room })) {
    expect(chunk.terrain[index], `terrain ${index}`).toBe(TERRAIN.Void);
    expect(chunk.tiles[index], `tile ${index}`).toBe(TILE.Void);
    expect(chunk.features[index], `feature ${index}`).toBe(expectedTile);
    expect(chunk.featureFaces[index], `feature face ${index}`)
      .toBe(expectedTile === TILE.DoorExit ? FEATURE_FACE.North : FEATURE_FACE.Top);
    expect(chunk.featureHeight[index], `feature height ${index}`)
      .toBe(expectedTile === TILE.DoorExit ? WALL_DOOR_FEATURE_HEIGHT : 0);
    expect(chunk.height[index], `height ${index}`).toBe(0);
    expect(chunk.zones[index], `zone ${index}`).toBe(ZONE.None);
    return;
  }
  expect(chunk.terrain[index], `terrain ${index}`).toBe(TERRAIN.Floor);
  expect(chunk.tiles[index], `tile ${index}`).toBe(TILE.Floor);
  expect(chunk.height[index], `height ${index}`).toBe(ly === top ? ROOM_WALL_RISE : 0);
  expect(chunk.zones[index], `zone ${index}`).toBe(ZONE.Sanctuary);
  expect(chunk.features[index], `feature ${index}`).toBe(expectedTile);
  expect(chunk.featureFaces[index], `feature face ${index}`).toBe(0);
  expect(chunk.featureHeight[index], `feature height ${index}`).toBe(0);
}

function expectedRoomTile(input: { lx: number; ly: number; room: RoomCase }): number {
  const { lx, ly, room } = input;
  const top = Math.floor(CHUNK_SIZE / 2 - room.height / 2);
  const left = Math.floor(CHUNK_SIZE / 2 - room.width / 2);
  const exitY = top + room.height - 1 + SOUTH_EXIT_HALL_DEPTH;
  if (lx === Math.floor(CHUNK_SIZE / 2) && ly === exitY) return TILE.DoorExit;
  if (room.kind !== "personal" || ly !== top + 1) return TILE.Floor;
  if (lx === left + 1) return TILE.Stash;
  return lx === left + room.width - 2 ? TILE.CraftingTable : TILE.Floor;
}

interface RoomCase {
  kind: "personal" | "party" | "safe";
  position: { cx: number; cy: number };
  width: number;
  height: number;
}

const ROOM_CASES: readonly RoomCase[] = [
  {
    kind: "personal",
    position: personalRoomChunk(0),
    width: PERSONAL_ROOM_W,
    height: PERSONAL_ROOM_H,
  },
  {
    kind: "party",
    position: partyRoomChunk(0),
    width: PARTY_ROOM_W,
    height: PARTY_ROOM_H,
  },
  {
    kind: "safe",
    position: safeRoomChunk(4, 7),
    width: SAFE_ROOM_W,
    height: SAFE_ROOM_H,
  },
];

describe("south exit geometry", () => {
  it.each(ROOM_CASES)(
    "keeps the $kind room, back wall, and two hall tiles as the exact chunk mask",
    (room) => {
      const { position } = room;
      const chunk = generateRoomChunk(position.cx, position.cy);
      assertCarvedMask(chunk, room);
    },
  );
});

describe("personal room fixtures", () => {
  it("mounts the exit on the collision wall at the far end of the hall", () => {
    const { cx, cy } = personalRoomChunk(0);
    const chunk = generateRoomChunk(cx, cy);
    const exit = personalRoomFeatures(0).exit;
    expect(tileAt(chunk, exit.x, exit.y)).toBe(TILE.DoorExit);
    expect(chunk.terrain[(exit.y - cy * CHUNK_SIZE) * CHUNK_SIZE + exit.x - cx * CHUNK_SIZE])
      .toBe(TERRAIN.Void);
    const spawn = personalRoomSpawn(0);
    expect(spawn.y).toBeLessThan(exit.y);
  });
});
