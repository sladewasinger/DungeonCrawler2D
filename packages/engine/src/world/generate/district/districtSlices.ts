import { CHUNK_SIZE } from "../../core/types.js";
import type {
  GeneratedTerrain,
} from "../runtimeChunk.js";
import type { ChunkFeatureState } from "../generationState.js";
import type { Rect, Room } from "../types.js";
import type {
  DistrictGenerationState,
  DistrictTerrainBuffers,
} from "./districtState.js";
import { DISTRICT_CHUNK_SPAN, DISTRICT_TILE_SPAN } from "../layout/district.js";

export interface ChunkCoordinate {
  readonly cx: number;
  readonly cy: number;
}

type NumericPlane = Uint8Array | Float32Array;

export function districtChunkCoordinates(
  state: DistrictGenerationState,
): ChunkCoordinate[] {
  const coordinates: ChunkCoordinate[] = [];
  for (let y = 0; y < DISTRICT_CHUNK_SPAN; y++) {
    for (let x = 0; x < DISTRICT_CHUNK_SPAN; x++) {
      coordinates.push({ cx: state.origin.cx + x, cy: state.origin.cy + y });
    }
  }
  return coordinates;
}

function chunkOffset(
  state: DistrictGenerationState,
  coordinate: ChunkCoordinate,
): { x: number; y: number } {
  return {
    x: (coordinate.cx - state.origin.cx) * CHUNK_SIZE,
    y: (coordinate.cy - state.origin.cy) * CHUNK_SIZE,
  };
}

function extractPlane(source: NumericPlane, offset: { x: number; y: number }): NumericPlane {
  const output = source instanceof Float32Array
    ? new Float32Array(CHUNK_SIZE * CHUNK_SIZE)
    : new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  for (let y = 0; y < CHUNK_SIZE; y++) {
    const start = (offset.y + y) * DISTRICT_TILE_SPAN + offset.x;
    output.set(source.subarray(start, start + CHUNK_SIZE), y * CHUNK_SIZE);
  }
  return output;
}

function copyPlane(
  source: NumericPlane,
  target: NumericPlane,
  offset: { x: number; y: number },
): void {
  for (let y = 0; y < CHUNK_SIZE; y++) {
    const start = (offset.y + y) * DISTRICT_TILE_SPAN + offset.x;
    target.set(source.subarray(y * CHUNK_SIZE, (y + 1) * CHUNK_SIZE), start);
  }
}

function intersectRect(rect: Rect, offset: { x: number; y: number }): Rect | null {
  const x0 = Math.max(rect.x0, offset.x);
  const y0 = Math.max(rect.y0, offset.y);
  const x1 = Math.min(rect.x1, offset.x + CHUNK_SIZE - 1);
  const y1 = Math.min(rect.y1, offset.y + CHUNK_SIZE - 1);
  if (x0 > x1 || y0 > y1) return null;
  return {
    x0: x0 - offset.x,
    y0: y0 - offset.y,
    x1: x1 - offset.x,
    y1: y1 - offset.y,
  };
}

function roomsInChunk(
  state: DistrictGenerationState,
  offset: { x: number; y: number },
): Room[] {
  const rooms: Room[] = [];
  for (const room of state.rooms) {
    const rect = intersectRect(room.rect, offset);
    if (rect) rooms.push({ rect, flavor: room.flavor });
  }
  return rooms;
}

function extractBuffers(
  state: DistrictGenerationState,
  offset: { x: number; y: number },
): DistrictTerrainBuffers {
  return {
    tiles: extractPlane(state.tiles, offset) as Uint8Array,
    featureTiles: extractPlane(state.featureTiles, offset) as Uint8Array,
    featureFaces: extractPlane(state.featureFaces, offset) as Uint8Array,
    featureHeight: extractPlane(state.featureHeight, offset) as Float32Array,
    height: extractPlane(state.height, offset) as Float32Array,
    zones: extractPlane(state.zones, offset) as Uint8Array,
    corridorCarved: extractPlane(state.corridorCarved, offset) as Uint8Array,
  };
}

export function extractChunkFeatureState(
  state: DistrictGenerationState,
  coordinate: ChunkCoordinate,
): ChunkFeatureState {
  const offset = chunkOffset(state, coordinate);
  return {
    worldSeed: state.worldSeed,
    floor: state.floor,
    ...coordinate,
    ...extractBuffers(state, offset),
    floorLayoutSeed: state.floorLayoutSeed,
    district: state.district,
    rooms: roomsInChunk(state, offset),
  };
}

export function writeChunkFeatureState(
  district: DistrictGenerationState,
  chunk: ChunkFeatureState,
): void {
  const offset = chunkOffset(district, chunk);
  copyPlane(chunk.tiles, district.tiles, offset);
  copyPlane(chunk.featureTiles, district.featureTiles, offset);
  copyPlane(chunk.featureFaces, district.featureFaces, offset);
  copyPlane(chunk.featureHeight, district.featureHeight, offset);
  copyPlane(chunk.height, district.height, offset);
  copyPlane(chunk.zones, district.zones, offset);
  copyPlane(chunk.corridorCarved, district.corridorCarved, offset);
}

export function extractChunkTerrain(
  state: DistrictGenerationState,
  coordinate: ChunkCoordinate,
): GeneratedTerrain {
  const offset = chunkOffset(state, coordinate);
  return {
    ...extractBuffers(state, offset),
    worldFeatures: state.worldFeatures,
  };
}
