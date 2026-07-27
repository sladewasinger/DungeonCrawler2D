import { CHUNK_SIZE, TILE, isSafeRoomChunk } from "@dc2d/engine";
import type { GameSim } from "../../index.js";

interface ChunkPosition {
  x: number;
  y: number;
}

interface DoorPosition extends ChunkPosition {
  doorCx: number;
  doorCy: number;
}

const SEARCH_CHUNK_LIMIT = 16;

export function findSafeRoomDoor(sim: GameSim): DoorPosition {
  const safeRoom = nearbySafeRoomChunks(sim).find((chunk) => scanChunkForDoor(sim, chunk));
  if (!safeRoom) throw new Error("no safe-room door found within the scanned chunk range");
  const door = scanChunkForDoor(sim, safeRoom)!;
  return { ...door, doorCx: safeRoom.x, doorCy: safeRoom.y };
}

function nearbySafeRoomChunks(sim: GameSim): ChunkPosition[] {
  return chunkPositions().filter(({ x, y }) =>
    isSafeRoomChunk({ worldSeed: sim.world.worldSeed, floor: sim.world.floor, cx: x, cy: y }),
  );
}

function chunkPositions(): ChunkPosition[] {
  return Array.from({ length: SEARCH_CHUNK_LIMIT }, (_, y) =>
    Array.from({ length: SEARCH_CHUNK_LIMIT }, (_, x) => ({ x, y })),
  ).flat();
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
