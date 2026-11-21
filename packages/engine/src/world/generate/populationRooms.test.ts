import { describe, expect, it } from "vitest";
import { hashString } from "../../core/rng.js";
import { CHUNK_SIZE } from "../core/types.js";
import { generateFiniteFloor, type GeneratedFloor } from "./finiteFloor.js";
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
const GENERATED_FLOOR = generateFiniteFloor(FLOOR_INPUT);
const CHUNK = findPopulationChunk(GENERATED_FLOOR);

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

function findPopulationChunk(floor: GeneratedFloor): PopulationChunk {
  const room = floor.rooms[0];
  if (!room) throw new Error("Expected a generated population room");
  return {
    ...FLOOR_INPUT, generatedFloor: floor,
    cx: Math.floor(room.center.x / CHUNK_SIZE), cy: Math.floor(room.center.y / CHUNK_SIZE),
  };
}

function findLootChunk(): PopulationChunk {
  for (const chunk of generatedRoomChunks(GENERATED_FLOOR)) {
    if (roomLootSpotsForChunk(chunk).length > 0) return chunk;
  }
  throw new Error("Expected an eligible generated room-loot chunk");
}

function generatedRoomChunks(floor: GeneratedFloor): PopulationChunk[] {
  const coordinates = new Set<string>();
  for (const room of floor.rooms) addRoomChunkCoordinates(coordinates, room);
  return [...coordinates].map((coordinate) => {
    const [cx, cy] = coordinate.split(",").map(Number);
    if (cx === undefined || cy === undefined) throw new Error(`Invalid chunk coordinate: ${coordinate}`);
    return { ...FLOOR_INPUT, generatedFloor: floor, cx, cy };
  });
}

function addRoomChunkCoordinates(
  coordinates: Set<string>,
  room: GeneratedFloor["rooms"][number],
): void {
  const minimumCx = Math.floor(room.x0 / CHUNK_SIZE);
  const maximumCx = Math.floor(room.x1 / CHUNK_SIZE);
  const minimumCy = Math.floor(room.y0 / CHUNK_SIZE);
  const maximumCy = Math.floor(room.y1 / CHUNK_SIZE);
  for (let cy = minimumCy; cy <= maximumCy; cy += 1) {
    for (let cx = minimumCx; cx <= maximumCx; cx += 1) coordinates.add(`${cx},${cy}`);
  }
}
