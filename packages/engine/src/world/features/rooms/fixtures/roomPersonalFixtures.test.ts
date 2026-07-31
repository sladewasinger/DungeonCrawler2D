import { describe, expect, it } from "vitest";
import { CHUNK_SIZE, TERRAIN, TILE } from "../../../core/types.js";
import { ROOM_WALL_RISE } from "../roomExitGeometry.js";
import {
  generateRoomChunk,
  personalRoomChunk,
  personalRoomFeatures,
  personalRoomSpawn,
} from "../rooms.js";

describe("personal room fixtures", () => {
  it("mounts the exit on the collision wall at the far end of the hall", () => {
    const { cx, cy } = personalRoomChunk(0);
    const chunk = generateRoomChunk(cx, cy);
    const exit = personalRoomFeatures(0).exit;
    const exitIndex = (exit.y - cy * CHUNK_SIZE) * CHUNK_SIZE +
      exit.x - cx * CHUNK_SIZE;

    expect(chunk.features[exitIndex]).toBe(TILE.DoorExit);
    expect(chunk.terrain[exitIndex]).toBe(TERRAIN.Floor);
    expect(chunk.tiles[exitIndex]).toBe(TILE.Bedrock);
    expect(chunk.height[exitIndex]).toBe(ROOM_WALL_RISE);
    expect(personalRoomSpawn(0).y).toBeLessThan(exit.y);
  });
});
