// Super-chunk (3x3 chunk) district assignment: gives the BSP room layout a
// macro-scale character — named neighborhoods instead of one uniform room
// family across the whole floor.

import { hash2D, mixSeeds } from "../../../core/rng.js";
import { WORLD_GENERATION_TUNING } from "../tuning.js";

export const SUPERCHUNK_SIZE = WORLD_GENERATION_TUNING.districts.chunkSpan;

export const DISTRICT = {
  Warren: 0,
  Plaza: 1,
  Ruins: 2,
  PillarForest: 3,
  Flooded: 4,
  Arena: 5,
} as const;
export type DistrictKind = (typeof DISTRICT)[keyof typeof DISTRICT];

const DISTRICT_KINDS: readonly DistrictKind[] = [
  DISTRICT.Warren,
  DISTRICT.Plaza,
  DISTRICT.Ruins,
  DISTRICT.PillarForest,
  DISTRICT.Flooded,
  DISTRICT.Arena,
];

export const BIOME = {
  Maze: "maze",
  OpenHalls: "open-halls",
  Ruins: "ruins",
  Pillars: "pillars",
  Pools: "pools",
  Arena: "arena",
} as const;
export type BiomeKind = (typeof BIOME)[keyof typeof BIOME];

export function biomeForDistrict(district: DistrictKind): BiomeKind {
  if (district === DISTRICT.Warren) return BIOME.Maze;
  if (district === DISTRICT.Plaza) return BIOME.OpenHalls;
  if (district === DISTRICT.Ruins) return BIOME.Ruins;
  if (district === DISTRICT.PillarForest) return BIOME.Pillars;
  if (district === DISTRICT.Flooded) return BIOME.Pools;
  return BIOME.Arena;
}

interface ChunkCoord {
  cx: number;
  cy: number;
}

function superOrigin(c: number): number {
  return Math.floor(c / SUPERCHUNK_SIZE) * SUPERCHUNK_SIZE;
}

/** Which 3x3 super-chunk a chunk belongs to, as that super-chunk's low corner. */
export function superchunkOf(cx: number, cy: number): { scx: number; scy: number } {
  return { scx: superOrigin(cx), scy: superOrigin(cy) };
}

/** The district character for a chunk's whole super-chunk (pure, deterministic). */
export function districtAt(seed: number, cx: number, cy: number): DistrictKind {
  const { scx, scy } = superchunkOf(cx, cy);
  const h = hash2D(mixSeeds(seed, 0xd15c), scx, scy);
  return DISTRICT_KINDS[h % DISTRICT_KINDS.length] ?? DISTRICT.Warren;
}

/** The one chunk per super-chunk that hosts its landmark: the center cell. */
export function isLandmarkChunk(cx: number, cy: number): boolean {
  const { scx, scy } = superchunkOf(cx, cy);
  const centerOffset = Math.floor(SUPERCHUNK_SIZE / 2);
  return cx === scx + centerOffset && cy === scy + centerOffset;
}

/**
 * True where two orthogonally-adjacent chunks belong to different
 * super-chunks — an avenue seam, where the cross-chunk connector corridor
 * widens into a legible arterial road (edges.ts's edgeWidth).
 */
export function avenueBetween(a: ChunkCoord, b: ChunkCoord): boolean {
  const sa = superchunkOf(a.cx, a.cy);
  const sb = superchunkOf(b.cx, b.cy);
  return sa.scx !== sb.scx || sa.scy !== sb.scy;
}
