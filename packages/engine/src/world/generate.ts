import { WALL_RISE } from "../core/constants";
import { applyCustomMap } from "./features/custommap";
import { applyFlattenedFeature } from "./features/fixed";
import { applyPlatformCluster } from "./features/platforms";
import { sealInteriorPockets } from "./pockets";
import { applyTerrace } from "./features/terraces";
import { generateRoomChunk, isRoomChunk } from "./features/rooms";
import {
  CORRIDOR_HALF_WIDTH,
  baseSample,
  corridorSegments,
  distToCorridor,
  seedsFor,
} from "./terrain";
import { applyTestZone } from "./features/testzone";
import { CHUNK_SIZE, TILE, type Chunk } from "./types";

/**
 * Chunked, deterministic world generation — LAYOUT FIRST, HEIGHT SECOND.
 *
 * `generateChunk` builds a FLAT dungeon: cave-noise walls, the corridor
 * network (terrain.ts), fixed features (features.ts), dev scaffolding
 * (testzone.ts), Tile Studio stamps (custommap.ts), and a reachability
 * pass (pockets.ts) — all at height 0. Verticality is then layered on
 * only by deliberate features that make sense as *places*: ruin
 * platform clusters (platforms.ts), wall tops rising WALL_RISE, and the
 * authored proving ground. No noise heightfield — height changes exist
 * where something was built, never because a contour happened to pass
 * through a hallway. Every layer is a pure function of world
 * coordinates, so chunk borders always agree.
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
  applyPlatformCluster(worldSeed, floor, cx, cy, seeds, segs, tiles, height);
  applyTerrace(worldSeed, floor, cx, cy, segs, tiles, height); // raised sections
  applyTestZone(cx, cy, tiles, height, zones); // dev scaffolding — see testzone.ts
  applyCustomMap(cx, cy, tiles, height, corridorCarved); // Tile Studio stamps
  sealInteriorPockets(tiles, corridorCarved, zones);

  // Walls are terrain: raise every wall tile WALL_RISE above the ground
  // it stands on. Height (not a solidity axiom) is what blocks walking
  // into a wall — and what lets you jump onto its top and walk it.
  // Runs last so sealed pockets and stamped walls rise too; pure per
  // tile, so chunk seams still agree.
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === TILE.Wall) height[i] = height[i]! + WALL_RISE;
  }

  return { cx, cy, tiles, height, zones };
}
