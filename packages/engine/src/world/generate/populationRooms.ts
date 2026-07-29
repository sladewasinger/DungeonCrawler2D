import { hash2D, mixSeeds } from "../../core/rng.js";
import { CHUNK_SIZE } from "../core/types.js";
import { isSafeRoomChunk, isStairsChunk } from "../features/fixed/fixed.js";
import { partitionRegion } from "./layout/bsp.js";
import {
  districtAt,
  districtCoordinateForChunk,
  districtOriginForChunk,
  DISTRICT_TILE_SPAN,
} from "./layout/district.js";
import { districtSeed, layoutSeed } from "./layout/hash.js";
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
  const coordinate = districtCoordinateForChunk(cx, cy);
  const origin = districtOriginForChunk(cx, cy);
  const rooms = partitionRegion(
    districtSeed(seed, coordinate.dx, coordinate.dy),
    DISTRICT_TILE_SPAN,
    district,
  ).rooms;
  const offsetX = (cx - origin.cx) * CHUNK_SIZE;
  const offsetY = (cy - origin.cy) * CHUNK_SIZE;
  return rooms.flatMap(({ rect }) => {
    const clipped = clipToChunk(rect, offsetX, offsetY);
    if (!clipped) return [];
    return [worldPopulationRoom(clipped, origin.cx, origin.cy)];
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
  originCx: number,
  originCy: number,
): PopulationRoom {
  const x0 = originCx * CHUNK_SIZE + rect.x0;
  const y0 = originCy * CHUNK_SIZE + rect.y0;
  const x1 = originCx * CHUNK_SIZE + rect.x1;
  const y1 = originCy * CHUNK_SIZE + rect.y1;
  return { x0, y0, x1, y1, area: (x1 - x0 + 1) * (y1 - y0 + 1) };
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
