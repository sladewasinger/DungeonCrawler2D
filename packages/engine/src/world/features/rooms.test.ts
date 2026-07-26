import { describe, expect, it } from "vitest";
import { CHUNK_SIZE, TILE } from "../types.js";
import {
  displayCoordinates,
  generateRoomChunk,
  partyRoomChunk,
  personalRoomSpawn,
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

  it("puts the only static door at the bottom of a recessed hallway", () => {
    const { cx, cy } = safeRoomChunk(4, 7);
    const chunk = generateRoomChunk(cx, cy);
    const exit = safeRoomFeatures(4, 7).exit;
    expect(tileAt(chunk, exit.x, exit.y)).toBe(TILE.DoorExit);
    expect(tileAt(chunk, exit.x, exit.y + 1)).toBe(TILE.Floor);
    expect(tileAt(chunk, exit.x, exit.y + 2)).toBe(TILE.Floor);
  });
});

describe("party room's south exit alcove", () => {
  it("cuts a two-tile alcove through the south wall", () => {
    const { cx, cy } = partyRoomChunk(0);
    const chunk = generateRoomChunk(cx, cy);
    const exitLi = chunk.tiles.findIndex((tile) => tile === TILE.DoorExit);
    const exitLx = exitLi % CHUNK_SIZE;
    const exitLy = (exitLi - exitLx) / CHUNK_SIZE;
    expect(chunk.tiles[(exitLy + 1) * CHUNK_SIZE + exitLx]).toBe(TILE.Floor);
    expect(chunk.tiles[(exitLy + 2) * CHUNK_SIZE + exitLx]).toBe(TILE.Floor);
    expect(chunk.tiles[(exitLy + 1) * CHUNK_SIZE + exitLx - 1]).toBe(TILE.Wall);
    expect(chunk.tiles[(exitLy + 1) * CHUNK_SIZE + exitLx + 1]).toBe(TILE.Wall);
  });
});

describe("room display coordinates", () => {
  it("keeps overworld positions global and room positions chunk-local", () => {
    expect(displayCoordinates(-17.25, 42.5)).toEqual({ x: -17.25, y: 42.5 });
    const spawn = personalRoomSpawn(3);
    expect(displayCoordinates(spawn.x, spawn.y)).toEqual({ x: 0.5, y: -2.5 });
  });
});
