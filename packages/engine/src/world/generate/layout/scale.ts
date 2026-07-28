import { TERRAIN, TILE, TOPOLOGY, type Chunk } from "../../core/types.js";
import { DEFAULT_WORLD_FEATURES, type WorldFeatures } from "../../core/worldFeatures.js";

export const WORLD_GEOMETRY_SCALE = 1;
export const GENERATION_CHUNK_SIZE = 32;
export const SCALED_CHUNK_SIZE = GENERATION_CHUNK_SIZE * WORLD_GEOMETRY_SCALE;
const FLOOR_TILE = 0;
const DEFAULT_SOURCE_TILE = TILE.Floor;
const FIRST_DISCRETE_FEATURE_TILE = 3;
const LAST_DISCRETE_FEATURE_TILE = 8;

interface GeneratedChunkData {
  readonly tiles: Uint8Array;
  readonly height: Float32Array;
  readonly zones: Uint8Array;
  readonly features?: WorldFeatures;
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
  const sourceHeight = source.height[sourceIndex] ?? 0;
  const anchor = isFeatureAnchor(tile, ox, oy);
  const cellTile = sourceTileForCell(tile, anchor);
  const voidCell = isVoidSource(cellTile, source.features?.voidTerrain ?? DEFAULT_WORLD_FEATURES.voidTerrain);
  buffers.tiles[targetIndex] = runtimeTileForCell({ tile, cellTile, anchor, voidCell });
  buffers.terrain[targetIndex] = voidCell ? TERRAIN.Void : TERRAIN.Floor;
  buffers.features[targetIndex] = featureForCell(tile, cellTile, anchor);
  buffers.height[targetIndex] = voidCell ? 0 : sourceHeight;
  buffers.zones[targetIndex] = source.zones[sourceIndex] ?? 0;
}

function sourceTileForCell(tile: number, anchor: boolean): number {
  return anchor || !isDiscreteFeature(tile) ? tile : FLOOR_TILE;
}

function runtimeTileForCell({ tile, cellTile, anchor, voidCell }: { tile: number; cellTile: number; anchor: boolean; voidCell: boolean }): number {
  if (voidCell) return TILE.Void;
  if (anchor) return tile;
  if (isDiscreteFeature(tile)) return FLOOR_TILE;
  return cellTile === TOPOLOGY.Uncarved ? FLOOR_TILE : cellTile;
}

function featureForCell(tile: number, cellTile: number, anchor: boolean): number {
  return anchor ? featureFor(tile) : cellTile === TILE.Stairs ? TILE.Stairs : TILE.Floor;
}

function isFeatureAnchor(tile: number, ox: number, oy: number): boolean {
  return isDiscreteFeature(tile) && ox === 0 && oy === WORLD_GEOMETRY_SCALE - 1;
}

function placeFeatureAnchor({ buffers, sx, sy, tile }: { buffers: ScaledChunkBuffers; sx: number; sy: number; tile: number }): void {
  const anchorX = sx * WORLD_GEOMETRY_SCALE;
  const anchorY = sy * WORLD_GEOMETRY_SCALE + WORLD_GEOMETRY_SCALE - 1;
  const index = anchorY * buffers.size + anchorX;
  buffers.tiles[index] = tile;
  buffers.features[index] = featureFor(tile);
}

function isDiscreteFeature(tile: number): boolean {
  return tile >= FIRST_DISCRETE_FEATURE_TILE && tile <= LAST_DISCRETE_FEATURE_TILE;
}

function isVoidSource(tile: number, voidTerrain: boolean): boolean {
  assertVoidSourceAllowed(tile, voidTerrain);
  return tile === TILE.Void || (voidTerrain && tile === TOPOLOGY.Uncarved);
}

function assertVoidSourceAllowed(tile: number, voidTerrain: boolean): void {
  if (tile === TILE.Void && !voidTerrain) {
    throw new Error("Explicit VOID source leaked into disabled world generation");
  }
}

function featureFor(tile: number): number {
  return tile === TILE.Stairs || isDiscreteFeature(tile) ? tile : TILE.Floor;
}
