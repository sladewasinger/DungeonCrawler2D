import { describe, expect, it } from "vitest";
import { CHUNK_SIZE, TILE } from "../types.js";
import { carveSafeRoomEntrance } from "./fixed.js";

describe("carveSafeRoomEntrance", () => {
  it("builds a broad 5x3 kiosk with one portal in its south face", () => {
    const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE.Floor);
    carveSafeRoomEntrance(tiles, 10, 10);

    for (let y = 9; y <= 11; y++) {
      for (let x = 8; x <= 12; x++) {
        const expected = x === 10 && y === 11 ? TILE.DoorSafeRoom : TILE.Wall;
        expect(tiles[y * CHUNK_SIZE + x]).toBe(expected);
      }
    }
    expect(tiles[10 * CHUNK_SIZE + 7]).toBe(TILE.Floor);
    expect(tiles[12 * CHUNK_SIZE + 10]).toBe(TILE.Floor);
  });
});
