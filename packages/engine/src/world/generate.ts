import { applyCustomMap } from "./custommap";
import { applyFlattenedFeature } from "./features";
import { sealInteriorPockets } from "./pockets";
import { generateRoomChunk, isRoomChunk } from "./rooms";
import {
  CORRIDOR_HALF_WIDTH,
  baseSample,
  corridorSegments,
  distToCorridor,
  seedsFor,
} from "./terrain";
import { applyTestZone } from "./testzone";
import { CHUNK_SIZE, TILE, type Chunk } from "./types";

/**
 * Chunked, deterministic world generation: `generateChunk` layers the
 * base terrain sample (terrain.ts), fixed features (features.ts), dev
 * scaffolding (testzone.ts), Tile Studio stamps (custommap.ts), and a
 * reachability pass (pockets.ts). Every layer is a pure function of
 * world coordinates, so chunk borders always agree.
 */
export function generateChunk(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
): Chunk {
  if (isRoomChunk(cy)) return generateRoomChunk(cx, cy);
  const seeds = seedsFor(worldSeed, floor);
  const segs = corridorSegments(worldSeed, floor, cx, cy);

  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  const height = new Float32Array(CHUNK_SIZE * CHUNK_SIZE);
  const zones = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  const corridorCarved = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);

  const baseX = cx * CHUNK_SIZE;
  const baseY = cy * CHUNK_SIZE;

  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const wx = baseX + lx;
      const wy = baseY + ly;
      const i = ly * CHUNK_SIZE + lx;
      const { wall, height: h } = baseSample(seeds, segs, wx, wy);
      tiles[i] = wall ? TILE.Wall : TILE.Floor;
      height[i] = h;
      if (distToCorridor(segs, wx, wy) <= CORRIDOR_HALF_WIDTH) corridorCarved[i] = 1;
    }
  }

  applyFlattenedFeature(worldSeed, floor, cx, cy, seeds, segs, tiles, height, zones);
  applyTestZone(cx, cy, tiles, height, zones); // dev scaffolding — see testzone.ts
  applyCustomMap(cx, cy, tiles, height, corridorCarved); // Tile Studio stamps
  sealInteriorPockets(tiles, corridorCarved, zones);

  return { cx, cy, tiles, height, zones };
}
