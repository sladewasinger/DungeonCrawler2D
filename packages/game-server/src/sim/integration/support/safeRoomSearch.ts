import {
  CHUNK_SIZE,
  TILE,
  safeRoomChunk,
  safeRoomDoorPositions,
  type FeatureFace,
} from "@dc2d/engine";
import type { GameSim } from "../../core/index.js";

interface ChunkPosition {
  x: number;
  y: number;
}

interface DoorPosition extends ChunkPosition {
  doorCx: number;
  doorCy: number;
  featureFace: FeatureFace;
}

export function findSafeRoomDoor(sim: GameSim): DoorPosition {
  if (!sim.world.generatedFloor) return legacySafeRoomDoor();
  const safeRoom = nearbySafeRoomChunks(sim).find((chunk) => scanChunkForDoor(sim, chunk));
  if (!safeRoom) throw new Error("generated finite-floor fixture has no safe-room door");
  const door = scanChunkForDoor(sim, safeRoom)!;
  return {
    ...door,
    doorCx: safeRoom.x,
    doorCy: safeRoom.y,
    featureFace: sim.world.featureFaceAt(door.x, door.y),
  };
}

function legacySafeRoomDoor(): DoorPosition {
  const room = safeRoomChunk(0, 0);
  const door = safeRoomDoorPositions(room.cx, room.cy)[0];
  if (!door) throw new Error("legacy safe-room fixture has no door");
  return { ...door, doorCx: 0, doorCy: 0 };
}

function nearbySafeRoomChunks(sim: GameSim): ChunkPosition[] {
  const floor = sim.world.generatedFloor;
  if (!floor) return [];
  const chunks = floor.safeRooms.map(({ door }) => ({
    x: Math.floor(door.x / CHUNK_SIZE),
    y: Math.floor(door.y / CHUNK_SIZE),
  }));
  return chunks;
}

function scanChunkForDoor(sim: GameSim, chunk: ChunkPosition): ChunkPosition | undefined {
  return chunkTiles(chunk).find(({ x, y }) => sim.world.tileAt(x, y) === TILE.DoorSafeRoom);
}

function chunkTiles(chunk: ChunkPosition): ChunkPosition[] {
  return Array.from({ length: CHUNK_SIZE }, (_, y) =>
    Array.from({ length: CHUNK_SIZE }, (_, x) => ({
      x: chunk.x * CHUNK_SIZE + x,
      y: chunk.y * CHUNK_SIZE + y,
    })),
  ).flat();
}
