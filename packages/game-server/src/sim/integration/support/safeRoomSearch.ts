import {
  CHUNK_SIZE,
  TILE,
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
  const safeRoom = nearbySafeRoomChunks(sim).find((chunk) => scanChunkForDoor(sim, chunk));
  if (!safeRoom) throw new Error("no safe-room door found within the scanned chunk range");
  const door = scanChunkForDoor(sim, safeRoom)!;
  return {
    ...door,
    doorCx: safeRoom.x,
    doorCy: safeRoom.y,
    featureFace: sim.world.featureFaceAt(door.x, door.y),
  };
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
