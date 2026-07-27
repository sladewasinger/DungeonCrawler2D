import { describe, expect, it } from "vitest";
import { CHUNK_SIZE, TERRAIN, TILE } from "../types.js";
import { SOUTH_EXIT_HALL_DEPTH } from "./roomExitGeometry.js";
import {
  PARTY_ROOM_H,
  PARTY_ROOM_W,
  PERSONAL_ROOM_H,
  PERSONAL_ROOM_W,
  SAFE_ROOM_H,
  SAFE_ROOM_W,
  displayCoordinates,
  generateRoomChunk,
  partyRoomChunk,
  personalRoomChunk,
  personalRoomFeatures,
  personalRoomSpawn,
  safeRoomAttendantPosition,
  safeRoomChunk,
  safeRoomFeatures,
} from "./rooms.js";

const tileAt = (
  chunk: ReturnType<typeof generateRoomChunk>,
  wx: number,
  wy: number,
): number => {
  const lx = wx - chunk.cx * CHUNK_SIZE;
  const ly = wy - chunk.cy * CHUNK_SIZE;
  return chunk.tiles[ly * CHUNK_SIZE + lx] ?? -1;
};

const countTile = (tiles: Uint8Array, tile: number): number =>
  [...tiles].filter((entry) => entry === tile).length;

const within = (value: number, start: number, length: number): boolean =>
  value >= start && value < start + length;

function isCarvedRoomCell(input: { lx: number; ly: number; room: RoomCase }): boolean {
  const { lx, ly, room } = input;
  const top = Math.floor(CHUNK_SIZE / 2 - room.height / 2);
  const centerLx = Math.floor(CHUNK_SIZE / 2);
  const inRoom = within(lx, Math.floor(CHUNK_SIZE / 2 - room.width / 2), room.width) && within(ly, top, room.height);
  const inHall = within(lx, centerLx - 1, 3) && within(ly, top + room.height - 1, SOUTH_EXIT_HALL_DEPTH + 1);
  return inRoom || inHall;
}

function assertCarvedMask(chunk: ReturnType<typeof generateRoomChunk>, room: RoomCase): void {
  for (let index = 0; index < chunk.terrain.length; index++) {
    const lx = index % CHUNK_SIZE;
    const ly = Math.floor(index / CHUNK_SIZE);
    const expected = isCarvedRoomCell({ lx, ly, room }) ? TERRAIN.Floor : TERRAIN.Void;
    expect(chunk.terrain[index]).toBe(expected);
  }
}

interface RoomCase {
  kind: string;
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

describe("safe room doors", () => {
  it("keeps occupant portal sites as floor until replicated overrides arrive", () => {
    const { cx, cy } = safeRoomChunk(4, 7);
    const chunk = generateRoomChunk(cx, cy);
    const features = safeRoomFeatures(4, 7);
    expect(features.doors).toHaveLength(20);
    expect(new Set(features.doors.map((door) => `${door.x},${door.y}`)).size).toBe(20);
    expect(features.doors.every((door) => tileAt(chunk, door.x, door.y) === TILE.Floor))
      .toBe(true);
    expect(countTile(chunk.tiles, TILE.DoorPersonal)).toBe(0);
    expect(countTile(chunk.tiles, TILE.DoorParty)).toBe(0);
    expect(countTile(chunk.tiles, TILE.Stash)).toBe(0);
    expect(countTile(chunk.tiles, TILE.CraftingTable)).toBe(0);
  });

});

describe("south exit geometry", () => {
  it.each(ROOM_CASES)(
    "keeps the $kind room interior and hall as the complete carved mask",
    ({ position, width, height }) => {
      const chunk = generateRoomChunk(position.cx, position.cy);
      assertCarvedMask(chunk, { position, width, height, kind: "room" });
    },
  );
});

describe("personal room fixtures", () => {
  it("keeps the exit and spawn positions unchanged", () => {
    const { cx, cy } = personalRoomChunk(0);
    const chunk = generateRoomChunk(cx, cy);
    const exit = personalRoomFeatures(0).exit;
    expect(tileAt(chunk, exit.x, exit.y)).toBe(TILE.DoorExit);
    const spawn = personalRoomSpawn(0);
    expect(spawn).toEqual({ x: exit.x + 0.5, y: exit.y - 0.5 });
  });
});

describe("room display coordinates", () => {
  it("keeps overworld positions global and room positions chunk-local", () => {
    expect(displayCoordinates(-17.25, 42.5)).toEqual({ x: -17.25, y: 42.5 });
    const spawn = personalRoomSpawn(3);
    expect(displayCoordinates(spawn.x, spawn.y)).toEqual({ x: 0.5, y: 1.5 });
  });
});

describe("safe room attendant position", () => {
  it.each([
    [0, 4100],
    [-4, 4102],
    [12, 4120],
  ])("preserves the coordinates for chunk (%i, %i)", (cx, cy) => {
    expect(safeRoomAttendantPosition(cx, cy)).toEqual({
      x: cx * CHUNK_SIZE + CHUNK_SIZE / 2 - 5.5,
      y: cy * CHUNK_SIZE + CHUNK_SIZE / 2 - 3.5,
    });
  });
});
