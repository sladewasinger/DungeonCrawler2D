// District assignment and coordinates. A district is planned as one shared
// tile surface, then clipped into fixed-size runtime chunks.

import { hash2D, mixSeeds } from "../../../core/rng.js";
import { CHUNK_SIZE } from "../../core/types.js";
import { WORLD_GENERATION_TUNING } from "../tuning.js";

export const DISTRICT_CHUNK_SPAN = WORLD_GENERATION_TUNING.districts.chunkSpan;
export const DISTRICT_TILE_SPAN = DISTRICT_CHUNK_SPAN * CHUNK_SIZE;

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

export interface DistrictCoordinate {
  readonly dx: number;
  readonly dy: number;
}

export interface DistrictOrigin {
  readonly cx: number;
  readonly cy: number;
}

export function districtCoordinateForChunk(
  cx: number,
  cy: number,
): DistrictCoordinate {
  return {
    dx: Math.floor(cx / DISTRICT_CHUNK_SPAN),
    dy: Math.floor(cy / DISTRICT_CHUNK_SPAN),
  };
}

export function districtOriginForChunk(cx: number, cy: number): DistrictOrigin {
  const { dx, dy } = districtCoordinateForChunk(cx, cy);
  return {
    cx: dx * DISTRICT_CHUNK_SPAN,
    cy: dy * DISTRICT_CHUNK_SPAN,
  };
}

/** The district character shared by every runtime chunk in the district. */
export function districtAt(seed: number, cx: number, cy: number): DistrictKind {
  const { dx, dy } = districtCoordinateForChunk(cx, cy);
  const h = hash2D(mixSeeds(seed, 0xd15c), dx, dy);
  return DISTRICT_KINDS[h % DISTRICT_KINDS.length] ?? DISTRICT.Warren;
}

/** The center runtime chunk hosts the district's authored landmark. */
export function isLandmarkChunk(cx: number, cy: number): boolean {
  const origin = districtOriginForChunk(cx, cy);
  const centerOffset = Math.floor(DISTRICT_CHUNK_SPAN / 2);
  return cx === origin.cx + centerOffset && cy === origin.cy + centerOffset;
}
