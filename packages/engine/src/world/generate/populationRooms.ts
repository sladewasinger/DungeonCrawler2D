import { CHUNK_SIZE } from "../types.js";
import { partitionChunk } from "./bsp.js";
import { districtAt } from "./district.js";
import { architectSeed, chunkSeed } from "./hash.js";
import {
  GENERATION_CHUNK_SIZE,
  scaleGeneratedCoordinate,
} from "./scale.js";

export interface PopulationRoom {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly area: number;
}

export function populationRoomsForChunk(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
): PopulationRoom[] {
  const seed = architectSeed(worldSeed, floor);
  const district = districtAt(seed, cx, cy);
  const rooms = partitionChunk(
    chunkSeed(seed, cx, cy),
    GENERATION_CHUNK_SIZE,
    district,
  ).rooms;
  const originX = cx * CHUNK_SIZE;
  const originY = cy * CHUNK_SIZE;
  return rooms.map(({ rect }) => {
    const x0 = originX + scaleGeneratedCoordinate(rect.x0);
    const y0 = originY + scaleGeneratedCoordinate(rect.y0);
    const x1 = originX + scaleGeneratedCoordinate(rect.x1 + 1) - 1;
    const y1 = originY + scaleGeneratedCoordinate(rect.y1 + 1) - 1;
    return { x0, y0, x1, y1, area: (x1 - x0 + 1) * (y1 - y0 + 1) };
  });
}
