import { hash2D, mixSeeds } from "../../core/rng.js";
import { CHUNK_SIZE } from "../core/types.js";
import { finiteFloorForRuntime, type GeneratedFloor } from "./finiteFloor.js";
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
  readonly generatedFloor?: GeneratedFloor | null;
}

export function populationRoomsForChunk(input: PopulationChunk): PopulationRoom[] {
  const { worldSeed, floor, cx, cy } = input;
  const generated = input.generatedFloor ?? finiteFloorForRuntime({ worldSeed, floor });
  if (!chunkInsideFloor(generated, cx, cy)) return [];
  return generated.rooms.flatMap((room) => {
    const clipped = clipToChunk(room, cx * CHUNK_SIZE, cy * CHUNK_SIZE);
    return clipped ? [worldPopulationRoom(clipped)] : [];
  });
}

function clipToChunk(
  rect: { x0: number; y0: number; x1: number; y1: number },
  offsetX: number,
  offsetY: number,
): { x0: number; y0: number; x1: number; y1: number } | null {
  const x0 = Math.max(rect.x0, offsetX);
  const y0 = Math.max(rect.y0, offsetY);
  const x1 = Math.min(rect.x1, offsetX + CHUNK_SIZE - 1);
  const y1 = Math.min(rect.y1, offsetY + CHUNK_SIZE - 1);
  return x0 <= x1 && y0 <= y1 ? { x0, y0, x1, y1 } : null;
}

function worldPopulationRoom(
  rect: { x0: number; y0: number; x1: number; y1: number },
): PopulationRoom {
  return { ...rect, area: (rect.x1 - rect.x0 + 1) * (rect.y1 - rect.y0 + 1) };
}

function roomCenter(room: PopulationRoom): { x: number; y: number } {
  return {
    x: Math.floor((room.x0 + room.x1) / 2),
    y: Math.floor((room.y0 + room.y1) / 2),
  };
}

/** Stable spawn-search anchor inside the largest generated room in a chunk. */
export function populationAnchorForChunk(chunk: PopulationChunk): { x: number; y: number } | null {
  const rooms = populationRoomsForChunk(chunk);
  if (rooms.length === 0) return null;
  const largest = rooms.reduce((best, room) => room.area > best.area ? room : best);
  return roomCenter(largest);
}

function chunkInsideFloor(floor: GeneratedFloor, cx: number, cy: number): boolean {
  return cx >= floor.bounds.minChunkX && cx <= floor.bounds.maxChunkX
    && cy >= floor.bounds.minChunkY && cy <= floor.bounds.maxChunkY;
}

const POPULATION = WORLD_GENERATION_TUNING.population;

function isProvingGround({ cx, cy }: PopulationChunk): boolean {
  return cx >= 0 && cx <= 1 && cy >= 0 && cy <= 1;
}

function hasRoomLoot(chunk: PopulationChunk, generatedFloor: GeneratedFloor): boolean {
  if (isProvingGround(chunk) || isGeneratedFeatureChunk(chunk, generatedFloor)) {
    return false;
  }
  const seed = mixSeeds(placementSeed(chunk.worldSeed, chunk.floor), 0x9e5a);
  return hash2D(seed, chunk.cx, chunk.cy) %
    POPULATION.lootChunkFrequency === 0;
}

/** Up to three deterministic room-center loot candidates in eligible chunks. */
export function roomLootSpotsForChunk(chunk: PopulationChunk): Array<{ x: number; y: number }> {
  const generatedFloor = chunk.generatedFloor ?? finiteFloorForRuntime(chunk);
  if (!hasRoomLoot(chunk, generatedFloor)) return [];
  return populationRoomsForChunk({ ...chunk, generatedFloor })
    .slice()
    .sort((a, b) => b.area - a.area)
    .slice(0, POPULATION.lootSpotsPerChunk)
    .map(roomCenter)
    .map(({ x, y }) => ({ x: x + 0.5, y: y + 0.5 }));
}

function isGeneratedFeatureChunk(chunk: PopulationChunk, floor: GeneratedFloor): boolean {
  if (floor.safeRooms.some((site) => pointInChunk(site.door, chunk))) return true;
  const stairways = [...floor.downStairways, ...(floor.upStairway ? [floor.upStairway] : [])];
  return stairways.some((site) => site.chunk.cx === chunk.cx && site.chunk.cy === chunk.cy);
}

function pointInChunk(point: { readonly x: number; readonly y: number }, chunk: PopulationChunk): boolean {
  return Math.floor(point.x / CHUNK_SIZE) === chunk.cx && Math.floor(point.y / CHUNK_SIZE) === chunk.cy;
}
