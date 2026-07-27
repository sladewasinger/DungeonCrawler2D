import { TERRAIN, TILE, TOPOLOGY, type Chunk } from "../types.js";

export const WORLD_GEOMETRY_SCALE = 2;
export const GENERATION_CHUNK_SIZE = 32;
export const SCALED_CHUNK_SIZE = GENERATION_CHUNK_SIZE * WORLD_GEOMETRY_SCALE;
const FLOOR_TILE = 0;
const DEFAULT_SOURCE_TILE = TILE.Floor;
const STAIRS_TILE = 2;
const FIRST_DISCRETE_FEATURE_TILE = 3;
const LAST_DISCRETE_FEATURE_TILE = 8;

interface GeneratedChunkData {
  readonly tiles: Uint8Array;
  readonly height: Float32Array;
  readonly zones: Uint8Array;
}

interface ScaledChunkBuffers {
  tiles: Uint8Array;
  terrain: Uint8Array;
  features: Uint8Array;
  height: Float32Array;
  zones: Uint8Array;
  size: number;
}

export function scaleGeneratedCoordinate(value: number): number {
  return value * WORLD_GEOMETRY_SCALE;
}

export function scaleGeneratedPoint(point: { x: number; y: number }): { x: number; y: number } {
  return {
    x: scaleGeneratedCoordinate(point.x),
    y: scaleGeneratedCoordinate(point.y),
  };
}

export function scaleGeneratedChunk(
  cx: number,
  cy: number,
  source: GeneratedChunkData,
): Chunk {
  const size = SCALED_CHUNK_SIZE;
  const tiles = new Uint8Array(size * size);
  const terrain = new Uint8Array(size * size);
  const features = new Uint8Array(size * size);
  const height = new Float32Array(size * size);
  const zones = new Uint8Array(size * size);
  const buffers = { tiles, terrain, features, height, zones, size };
  for (let sy = 0; sy < GENERATION_CHUNK_SIZE; sy++) scaleGeneratedRow({ source, buffers, sy });
  return { cx, cy, tiles, terrain, features, height, zones };
}

function scaleGeneratedRow({ source, buffers, sy }: { source: GeneratedChunkData; buffers: ScaledChunkBuffers; sy: number }): void {
  for (let sx = 0; sx < GENERATION_CHUNK_SIZE; sx++) scaleGeneratedTile({ source, buffers, sx, sy });
}

function scaleGeneratedTile({ source, buffers, sx, sy }: { source: GeneratedChunkData; buffers: ScaledChunkBuffers; sx: number; sy: number }): void {
  const sourceIndex = sy * GENERATION_CHUNK_SIZE + sx;
  const tile = source.tiles[sourceIndex] ?? DEFAULT_SOURCE_TILE;
  for (let oy = 0; oy < WORLD_GEOMETRY_SCALE; oy++) for (let ox = 0; ox < WORLD_GEOMETRY_SCALE; ox++) scaleGeneratedCell({ source, buffers, sx, sy, ox, oy, tile, sourceIndex });
  if (isDiscreteFeature(tile)) placeFeatureAnchor({ buffers, sx, sy, tile });
}

function scaleGeneratedCell({ source, buffers, sx, sy, ox, oy, tile, sourceIndex }: { source: GeneratedChunkData; buffers: ScaledChunkBuffers; sx: number; sy: number; ox: number; oy: number; tile: number; sourceIndex: number }): void {
  const tx = sx * WORLD_GEOMETRY_SCALE + ox;
  const ty = sy * WORLD_GEOMETRY_SCALE + oy;
  const targetIndex = ty * buffers.size + tx;
  buffers.tiles[targetIndex] = isDiscreteFeature(tile) ? FLOOR_TILE : runtimeTileFor(tile);
  buffers.terrain[targetIndex] = terrainKindFor(tile);
  buffers.features[targetIndex] = tile === TILE.Stairs ? TILE.Stairs : TILE.Floor;
  buffers.height[targetIndex] = scaledHeightAt({ source, sx, sy, ox, oy, tile });
  buffers.zones[targetIndex] = source.zones[sourceIndex] ?? 0;
}

function placeFeatureAnchor({ buffers, sx, sy, tile }: { buffers: ScaledChunkBuffers; sx: number; sy: number; tile: number }): void {
  const anchorX = sx * WORLD_GEOMETRY_SCALE;
  const anchorY = sy * WORLD_GEOMETRY_SCALE + WORLD_GEOMETRY_SCALE - 1;
  const index = anchorY * buffers.size + anchorX;
  buffers.tiles[index] = runtimeTileFor(tile);
  buffers.features[index] = featureFor(tile);
}

function scaledHeightAt({ source, sx, sy, ox, oy, tile }: { source: GeneratedChunkData; sx: number; sy: number; ox: number; oy: number; tile: number }): number {
  const center = source.height[sy * GENERATION_CHUNK_SIZE + sx] ?? 0;
  if (tile !== STAIRS_TILE) return center;
  const west = generatedHeightAt({ height: source.height, x: sx - 1, y: sy, fallback: center });
  const east = generatedHeightAt({ height: source.height, x: sx + 1, y: sy, fallback: center });
  const north = generatedHeightAt({ height: source.height, x: sx, y: sy - 1, fallback: center });
  const south = generatedHeightAt({ height: source.height, x: sx, y: sy + 1, fallback: center });
  const horizontalDelta = straddlingDelta(west, center, east);
  const verticalDelta = straddlingDelta(north, center, south);
  if (horizontalDelta !== 0 || verticalDelta === 0) {
    return ox === 0
      ? center + (west - center) * 0.25
      : center + (east - center) * 0.25;
  }
  return oy === 0
    ? center + (north - center) * 0.25
    : center + (south - center) * 0.25;
}

function straddlingDelta(lowSide: number, center: number, highSide: number): number {
  const a = lowSide - center;
  const b = highSide - center;
  return a * b < 0 ? highSide - lowSide : 0;
}

function generatedHeightAt({ height, x, y, fallback }: { height: Float32Array; x: number; y: number; fallback: number }): number {
  if (x < 0 || y < 0 || x >= GENERATION_CHUNK_SIZE || y >= GENERATION_CHUNK_SIZE) return fallback;
  return height[y * GENERATION_CHUNK_SIZE + x] ?? fallback;
}

function isDiscreteFeature(tile: number): boolean {
  return tile >= FIRST_DISCRETE_FEATURE_TILE && tile <= LAST_DISCRETE_FEATURE_TILE;
}

function runtimeTileFor(tile: number): number {
  return tile === TOPOLOGY.Uncarved ? TILE.Floor : tile;
}

function terrainKindFor(tile: number): number {
  return tile === TILE.Void ? TERRAIN.Void : TERRAIN.Floor;
}

function featureFor(tile: number): number {
  return tile === TILE.Stairs || isDiscreteFeature(tile) ? tile : TILE.Floor;
}
