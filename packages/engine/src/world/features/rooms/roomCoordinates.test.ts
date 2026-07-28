import { describe, expect, it } from "vitest";
import { CHUNK_SIZE } from "../../core/types.js";
import {
  displayCoordinates,
  personalRoomSpawn,
  safeRoomAttendantPosition,
} from "./rooms.js";

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
