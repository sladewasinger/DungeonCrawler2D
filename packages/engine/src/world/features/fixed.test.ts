import { describe, expect, it } from "vitest";
import { CHUNK_SIZE, TILE } from "../types.js";
import { carveSafeRoomEntrance, KIOSK_HEIGHT } from "./fixed.js";

describe("carveSafeRoomEntrance", () => {
  it("builds a broad 5x3 kiosk TERRACE (walkable raised floor, not rock) with one portal in its south face", () => {
    const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE.Floor);
    const height = new Float32Array(CHUNK_SIZE * CHUNK_SIZE);
    carveSafeRoomEntrance(tiles, height, 10, 10);

    for (let y = 9; y <= 11; y++) {
      for (let x = 8; x <= 12; x++) {
        const i = y * CHUNK_SIZE + x;
        const isDoor = x === 10 && y === 11;
        expect(tiles[i]).toBe(isDoor ? TILE.DoorSafeRoom : TILE.Floor);
        // The door cell itself drops to ground level (0) so a grounded body
        // can actually walk up to it — see carveSafeRoomEntrance's doc comment.
        expect(height[i]).toBe(isDoor ? 0 : KIOSK_HEIGHT);
      }
    }
    expect(tiles[10 * CHUNK_SIZE + 7]).toBe(TILE.Floor);
    expect(tiles[12 * CHUNK_SIZE + 10]).toBe(TILE.Floor);
  });

  it("is 3 deep north-to-south — z+1 for z2, the generator's vertical-extent rule (VISUAL_DIRECTION.md)", () => {
    const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE.Floor);
    const height = new Float32Array(CHUNK_SIZE * CHUNK_SIZE);
    carveSafeRoomEntrance(tiles, height, 10, 10);

    let depth = 0;
    for (let y = 0; y < CHUNK_SIZE; y++) {
      if (height[y * CHUNK_SIZE + 8] === KIOSK_HEIGHT) depth++;
    }
    expect(depth).toBe(KIOSK_HEIGHT + 1);
  });
});
