import { WALL_RISE } from "../core/constants";
import { generateSandboxChunk } from "./features/testzone";
import { applyCustomMap } from "./features/custommap";
import { applyFlattenedFeature } from "./features/fixed";
import { applyPlatformCluster } from "./features/platforms";
import { generateRoomChunk, isRoomChunk } from "./features/rooms";
import { applyTerrace } from "./features/terraces";
import { LEVEL, type LevelId } from "./level";
import { sealInteriorPockets } from "./pockets";
import {
  CORRIDOR_HALF_WIDTH,
  baseSample,
  corridorSegments,
  distToCorridor,
  seedsFor,
} from "./terrain";
import { CHUNK_SIZE, TILE, type Chunk } from "./types";

export function generateChunk(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
  level: LevelId = LEVEL.Dungeon,
): Chunk {
  if (isRoomChunk(cy)) return generateRoomChunk(cx, cy);
  if (level === LEVEL.Sandbox) return generateSandboxChunk(cx, cy);

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
  applyCustomMap(cx, cy, tiles, height, corridorCarved);
  sealInteriorPockets(tiles, corridorCarved, zones);

  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === TILE.Wall) height[i] = height[i]! + WALL_RISE;
  }

  return { cx, cy, tiles, height, zones };
}
