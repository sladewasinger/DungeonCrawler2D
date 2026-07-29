import { hash2D, mixSeeds } from "../../core/rng.js";
import { CHUNK_SIZE } from "../core/types.js";
import { isSafeRoomChunk, isStairsChunk } from "../features/fixed/fixed.js";
import { partitionChunk } from "./layout/bsp.js";
import { districtAt } from "./layout/district.js";
import { chunkSeed, layoutSeed } from "./layout/hash.js";
import { placementSeed } from "./layout/placement.js";
import { WORLD_GENERATION_TUNING } from "./tuning.js";

export interface PopulationRoom {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly area: number;
}

export interface PopulationChunk {
  readonly worldSeed: number;
  readonly floor: number;
  readonly cx: number;
  readonly cy: number;
}

export function populationRoomsForChunk({
  worldSeed,
  floor,
  cx,
  cy,
}: PopulationChunk): PopulationRoom[] {
  const seed = layoutSeed(worldSeed, floor);
  const district = districtAt(seed, cx, cy);
  const rooms = partitionChunk(
    chunkSeed(seed, cx, cy),
    CHUNK_SIZE,
    district,
  ).rooms;
  const originX = cx * CHUNK_SIZE;
  const originY = cy * CHUNK_SIZE;
  return rooms.map(({ rect }) => {
    const x0 = originX + rect.x0;
    const y0 = originY + rect.y0;
    const x1 = originX + rect.x1;
    const y1 = originY + rect.y1;
    return { x0, y0, x1, y1, area: (x1 - x0 + 1) * (y1 - y0 + 1) };
  });
}

function roomCenter(room: PopulationRoom): { x: number; y: number } {
  return {
    x: Math.floor((room.x0 + room.x1) / 2),
    y: Math.floor((room.y0 + room.y1) / 2),
  };
}

/** Stable spawn-search anchor inside the largest generated room in a chunk. */
export function populationAnchorForChunk(chunk: PopulationChunk): { x: number; y: number } {
  const rooms = populationRoomsForChunk(chunk);
  const largest = rooms.reduce((best, room) => room.area > best.area ? room : best);
  return roomCenter(largest);
}

const POPULATION = WORLD_GENERATION_TUNING.population;

function isProvingGround({ cx, cy }: PopulationChunk): boolean {
  return cx >= 0 && cx <= 1 && cy >= 0 && cy <= 1;
}

function hasRoomLoot(chunk: PopulationChunk): boolean {
  if (isProvingGround(chunk) || isSafeRoomChunk(chunk) || isStairsChunk(chunk)) {
    return false;
  }
  const seed = mixSeeds(placementSeed(chunk.worldSeed, chunk.floor), 0x9e5a);
  return hash2D(seed, chunk.cx, chunk.cy) %
    POPULATION.lootChunkFrequency === 0;
}

/** Up to three deterministic room-center loot candidates in eligible chunks. */
export function roomLootSpotsForChunk(chunk: PopulationChunk): Array<{ x: number; y: number }> {
  if (!hasRoomLoot(chunk)) return [];
  return populationRoomsForChunk(chunk)
    .slice()
    .sort((a, b) => b.area - a.area)
    .slice(0, POPULATION.lootSpotsPerChunk)
    .map(roomCenter)
    .map(({ x, y }) => ({ x: x + 0.5, y: y + 0.5 }));
}
