import { describe, expect, it } from "vitest";
import { hashString } from "../../core/rng.js";
import { CHUNK_SIZE } from "../core/types.js";
import { generateFiniteFloor } from "./finiteFloor.js";
import {
  populationAnchorForChunk,
  populationRoomsForChunk,
  roomLootSpotsForChunk,
  type PopulationChunk,
} from "./populationRooms.js";

const FLOOR_INPUT = {
  worldSeed: hashString("population-room-coordinates"),
  floor: 2,
};
const CHUNK = findPopulationChunk();

describe("population room geometry", () => {
  it("returns direct tile bounds inside the requested runtime chunk", () => {
    const rooms = populationRoomsForChunk(CHUNK);
    const minimumX = CHUNK.cx * CHUNK_SIZE;
    const minimumY = CHUNK.cy * CHUNK_SIZE;
    expect(rooms.length).toBeGreaterThan(0);
    for (const room of rooms) {
      expect(room.x0).toBeGreaterThanOrEqual(minimumX);
      expect(room.y0).toBeGreaterThanOrEqual(minimumY);
      expect(room.x1).toBeLessThan(minimumX + CHUNK_SIZE);
      expect(room.y1).toBeLessThan(minimumY + CHUNK_SIZE);
      expect(room.area).toBe((room.x1 - room.x0 + 1) * (room.y1 - room.y0 + 1));
    }
  });

  it("uses the largest active room as the chunk population anchor", () => {
    const rooms = populationRoomsForChunk(CHUNK);
    const largest = rooms.reduce((best, room) => room.area > best.area ? room : best);
    expect(populationAnchorForChunk(CHUNK)).toEqual({
      x: Math.floor((largest.x0 + largest.x1) / 2),
      y: Math.floor((largest.y0 + largest.y1) / 2),
    });
  });

  it("places eligible loot candidates at active room centers", () => {
    const chunk = findLootChunk();
    const rooms = populationRoomsForChunk(chunk);
    const centers = new Set(rooms.map((room) =>
      `${Math.floor((room.x0 + room.x1) / 2) + 0.5},` +
      `${Math.floor((room.y0 + room.y1) / 2) + 0.5}`));
    const spots = roomLootSpotsForChunk(chunk);
    expect(spots).toHaveLength(Math.min(3, rooms.length));
    for (const spot of spots) expect(centers.has(`${spot.x},${spot.y}`)).toBe(true);
  });

  it("uses supplied configured-floor metadata instead of regenerating defaults", () => {
    const generatedFloor = generateFiniteFloor({ ...FLOOR_INPUT, config: { roomSize: 11 } });
    const room = generatedFloor.rooms[0];
    expect(room).toBeDefined();
    if (!room) return;
    const chunk = {
      ...FLOOR_INPUT, generatedFloor,
      cx: Math.floor(room.center.x / CHUNK_SIZE), cy: Math.floor(room.center.y / CHUNK_SIZE),
    };
    expect(populationRoomsForChunk(chunk).length).toBeGreaterThan(0);
    expect(populationAnchorForChunk(chunk)).not.toBeNull();
  });
});

function findPopulationChunk(): PopulationChunk {
  const floor = generateFiniteFloor(FLOOR_INPUT);
  const room = floor.rooms[0];
  if (!room) throw new Error("Expected a generated population room");
  return {
    ...FLOOR_INPUT, generatedFloor: floor,
    cx: Math.floor(room.center.x / CHUNK_SIZE), cy: Math.floor(room.center.y / CHUNK_SIZE),
  };
}

function findLootChunk(): PopulationChunk {
  for (let cx = -8; cx <= 8; cx++) {
    const chunk = { ...CHUNK, cx, cy: 4 };
    if (roomLootSpotsForChunk(chunk).length > 0) return chunk;
  }
  throw new Error("Expected an eligible room-loot chunk in the scan range");
}
