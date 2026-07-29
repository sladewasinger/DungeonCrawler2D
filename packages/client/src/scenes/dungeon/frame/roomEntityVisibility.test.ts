import { CHUNK_SIZE, personalRoomChunk } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { isEntityVisibleFromRoom } from "./roomEntityVisibility.js";

describe("isEntityVisibleFromRoom", () => {
  it("preserves global dungeon visibility", () => {
    expect(isEntityVisibleFromRoom({
      viewerX: 5,
      viewerY: 5,
      entityX: 500,
      entityY: 500,
    })).toBe(true);
  });

  it("limits a reserved room view to its exact chunk", () => {
    const room = personalRoomChunk(0);
    const viewerX = room.cx * CHUNK_SIZE + 0.5;
    const viewerY = room.cy * CHUNK_SIZE + 0.5;

    expect(isEntityVisibleFromRoom({
      viewerX,
      viewerY,
      entityX: viewerX + CHUNK_SIZE - 1,
      entityY: viewerY,
    })).toBe(true);
    expect(isEntityVisibleFromRoom({
      viewerX,
      viewerY,
      entityX: viewerX + CHUNK_SIZE,
      entityY: viewerY,
    })).toBe(false);
  });
});
