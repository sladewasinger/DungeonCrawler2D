import { CHUNK_SIZE, FEATURE_FACE, TERRAIN, TILE, ZONE, type Chunk } from "../core/types.js";
import { insideBounds, localIndex } from "./finiteFloorBuffers.js";
import type { GeneratedFloor } from "./finiteFloorTypes.js";

export function sliceFloorChunk(floor: GeneratedFloor, cx: number, cy: number): Chunk {
  const chunk = emptyChunk(cx, cy);
  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      writeChunkCell({ floor, chunk, x: cx * CHUNK_SIZE + lx, y: cy * CHUNK_SIZE + ly, target: ly * CHUNK_SIZE + lx });
    }
  }
  return chunk;
}

/** Compatibility-only projection for the legacy public generateChunk facade. */
export function projectLegacySafeRoomKiosk(
  floor: GeneratedFloor,
  chunk: Chunk,
): Chunk {
  const site = floor.safeRooms.find((candidate) =>
    Math.floor(candidate.door.x / CHUNK_SIZE) === chunk.cx &&
    Math.floor(candidate.door.y / CHUNK_SIZE) === chunk.cy,
  );
  if (!site) return chunk;
  const localX = site.door.x - chunk.cx * CHUNK_SIZE;
  const localY = site.door.y - chunk.cy * CHUNK_SIZE;
  const doorIndex = localY * CHUNK_SIZE + localX;
  const stairIndex = doorIndex + CHUNK_SIZE;
  const padIndex = doorIndex + CHUNK_SIZE * 2;
  chunk.tiles[doorIndex] = TILE.Floor;
  chunk.height[doorIndex] = 2;
  chunk.features[stairIndex] = TILE.Stairs;
  chunk.tiles[stairIndex] = TILE.Floor;
  chunk.height[stairIndex] = 1;
  chunk.featureHeight[stairIndex] = 0.5;
  chunk.tiles[padIndex] = TILE.Floor;
  chunk.height[padIndex] = 0;
  return chunk;
}

function emptyChunk(cx: number, cy: number): Chunk {
  const cells = CHUNK_SIZE * CHUNK_SIZE;
  return {
    cx, cy, tiles: new Uint8Array(cells), terrain: new Uint8Array(cells),
    features: new Uint8Array(cells), featureFaces: new Uint8Array(cells),
    featureHeight: new Float32Array(cells), height: new Float32Array(cells),
    zones: new Uint8Array(cells),
  };
}

function writeChunkCell(input: { readonly floor: GeneratedFloor; readonly chunk: Chunk; readonly x: number; readonly y: number; readonly target: number }): void {
  if (!insideBounds({ bounds: input.floor.bounds, x: input.x, y: input.y })) {
    writeBoundaryCell(input.floor, input.chunk, input.target);
    return;
  }
  writeFloorCell(input, localIndex({ bounds: input.floor.bounds, x: input.x, y: input.y }));
}

function writeFloorCell(input: { readonly floor: GeneratedFloor; readonly chunk: Chunk; readonly target: number }, source: number): void {
  input.chunk.tiles[input.target] = input.floor.tiles[source] ?? TILE.Floor;
  input.chunk.terrain[input.target] = input.floor.terrain[source] ?? TERRAIN.Floor;
  input.chunk.features[input.target] = input.floor.features[source] ?? TILE.Floor;
  input.chunk.featureFaces[input.target] = input.floor.featureFaces[source] ?? FEATURE_FACE.Top;
  input.chunk.featureHeight[input.target] = input.floor.featureHeight[source] ?? 0;
  input.chunk.height[input.target] = input.floor.height[source] ?? 0;
  input.chunk.zones[input.target] = input.floor.zones[source] ?? ZONE.None;
}

function writeBoundaryCell(floor: GeneratedFloor, chunk: Chunk, target: number): void {
  chunk.tiles[target] = floor.voidTerrain ? TILE.Void : TILE.Bedrock;
  chunk.terrain[target] = floor.voidTerrain ? TERRAIN.Void : TERRAIN.Floor;
  chunk.height[target] = floor.voidTerrain ? 0 : 2;
}
