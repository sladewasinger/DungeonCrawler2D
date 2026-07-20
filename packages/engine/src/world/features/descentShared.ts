// Shared placement primitives for the floor-to-floor descent landmarks
// (descent.ts's StairwayUp/StairwayDown, bossArena.ts's floor-5 arena):
// picking exactly one chunk per role per floor from a fixed hashed angle
// around a fixed chebyshev chunk-radius ring — never a runtime search, so
// chunk generation stays pure and chunk-local (generate/index.ts's own
// "pure, chunk-local, byte-deterministic" contract) — plus the shared
// local-anchor jitter every role's footprint centers its stamp on.

import { hash2D, mixSeeds } from "../../core/rng.js";
import { seedsFor } from "../terrain.js";
import { CHUNK_SIZE } from "../types.js";
import { isSafeRoomChunk, isStairsChunk } from "./fixed.js";

/** Highest floor this wave generates; floor FLOOR_CAP hosts the boss arena instead of a StairwayDown. */
export const FLOOR_CAP = 5;

export interface ChunkCoord {
  cx: number;
  cy: number;
}

/** Every chunk at exact chebyshev distance `radius` from the origin chunk. */
function ringPerimeter(radius: number): ChunkCoord[] {
  if (radius <= 0) return [{ cx: 0, cy: 0 }];
  const cells: ChunkCoord[] = [];
  for (let cx = -radius; cx <= radius; cx++) {
    for (let cy = -radius; cy <= radius; cy++) {
      if (Math.max(Math.abs(cx), Math.abs(cy)) === radius) cells.push({ cx, cy });
    }
  }
  return cells;
}

/** True where a chunk is already claimed by a safe room or a stairway ramp — descent landmarks never displace those. */
function isReserved(worldSeed: number, floor: number, cx: number, cy: number): boolean {
  return isSafeRoomChunk(worldSeed, floor, cx, cy) || isStairsChunk(worldSeed, floor, cx, cy);
}

/**
 * One deterministic chunk on the ring at `radius`: a hashed starting angle,
 * walked forward (bounded by the ring's own size) until a free cell turns
 * up. Distinct `salt`s per role plus disjoint `radius` values per role
 * (descent.ts's/bossArena.ts's own constants) guarantee two roles can never
 * resolve to the same chunk, even coincidentally — different radius means
 * different ring, full stop, before any hashing even happens.
 */
export function pickRingChunk(worldSeed: number, floor: number, salt: number, radius: number): ChunkCoord {
  const seed = mixSeeds(seedsFor(worldSeed, floor).layout, salt);
  const perimeter = ringPerimeter(radius);
  const start = hash2D(seed, 1, 0) % perimeter.length;
  for (let step = 0; step < perimeter.length; step++) {
    const candidate = perimeter[(start + step) % perimeter.length];
    if (candidate && !isReserved(worldSeed, floor, candidate.cx, candidate.cy)) return candidate;
  }
  // Every ring cell reserved — astronomically unlikely (would need a safe
  // room or stairway ramp on EVERY chunk of the ring); fall back to the
  // hashed start rather than throwing out of a pure generator function.
  return perimeter[start] ?? { cx: radius, cy: 0 };
}

export interface LocalAnchor {
  lx: number;
  ly: number;
}

/**
 * A structure's local placement within its chosen chunk: offset from the
 * chunk's own center by a hashed jitter, kept `clearance` tiles from every
 * edge so a caller's own footprint (plus, for the boss arena, its exit
 * throat — see bossArena.ts's ARENA_CLEARANCE) never spills into a
 * neighboring chunk this generator pass can't touch.
 */
export function structureAnchor(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
  salt: number,
  clearance: number,
): LocalAnchor {
  const layout = seedsFor(worldSeed, floor).layout;
  const range = CHUNK_SIZE / 2 - clearance;
  const jx = (hash2D(mixSeeds(layout, salt), cx, cy) % (range * 2 + 1)) - range;
  const jy = (hash2D(mixSeeds(layout, salt + 1), cx, cy) % (range * 2 + 1)) - range;
  return { lx: CHUNK_SIZE / 2 + jx, ly: CHUNK_SIZE / 2 + jy };
}
