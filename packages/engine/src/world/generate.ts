import { WALL_RISE } from "../core/constants.js";
import { applyFlattenedFeature } from "./features/fixed.js";
import { applyPlatformCluster } from "./features/platforms.js";
import { generateRoomChunk, isRoomChunk } from "./features/rooms.js";
import { applyTerrace } from "./features/terraces.js";
import { LEVEL, type LevelId } from "./level.js";
import { sealInteriorPockets } from "./pockets.js";
import {
  CORRIDOR_HALF_WIDTH,
  baseSample,
  corridorSegments,
  distToCorridor,
  seedsFor,
} from "./terrain.js";
import { CHUNK_SIZE, TILE, type Chunk } from "./types.js";

/**
 * Deterministic chunk generator: layout, then deliberate height
 * features, then pocket sealing — same (worldSeed, floor, cx, cy)
 * always produces the same chunk.
 */

export function generateChunk(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
  // Sandbox proving-ground content is not part of this slice (see deviations);
  // the parameter stays for API compatibility with World, which still threads a level.
  _level: LevelId = LEVEL.Dungeon,
): Chunk {
  if (isRoomChunk(cy)) return generateRoomChunk(cx, cy);

  const seeds = seedsFor(worldSeed, floor);
  const segments = corridorSegments(worldSeed, floor, cx, cy);
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  const height = new Float32Array(CHUNK_SIZE * CHUNK_SIZE);
  const zones = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  const corridorCarved = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  const baseX = cx * CHUNK_SIZE;
  const baseY = cy * CHUNK_SIZE;

  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const x = baseX + lx;
      const y = baseY + ly;
      const i = ly * CHUNK_SIZE + lx;
      const sample = baseSample(seeds, segments, x, y);
      tiles[i] = sample.wall ? TILE.Wall : TILE.Floor;
      height[i] = sample.height;
      if (distToCorridor(segments, x, y) <= CORRIDOR_HALF_WIDTH) corridorCarved[i] = 1;
    }
  }

  applyFlattenedFeature(worldSeed, floor, cx, cy, seeds, segments, tiles, height, zones);
  applyPlatformCluster(worldSeed, floor, cx, cy, seeds, segments, tiles, height);
  applyTerrace(worldSeed, floor, cx, cy, segments, tiles, height);
  sealInteriorPockets(tiles, corridorCarved, zones);

  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === TILE.Wall) height[i] = (height[i] ?? 0) + WALL_RISE;
  }

  return { cx, cy, tiles, height, zones };
}
