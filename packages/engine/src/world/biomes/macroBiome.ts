/** Deterministic low-frequency 5-biome macro sampling and 5-tier distance progression. */
import type { BiomeKind, DangerTier } from "../types.js";
import { fbm2d } from "../../math/noise.js";

export const SPAWN_SAFE_BIOME_RADIUS = 220;
const BIOME_NOISE_FREQ = 0.0024;
const RUIN_NOISE_FREQ = 0.0025;

export const TIER_DISTANCES = {
  2: 1000,
  3: 2000,
  4: 3500,
  5: 6000,
} as const;

const BASE_TIERS: Readonly<Record<BiomeKind, DangerTier>> = {
  "verdant-forest": 1,
  "autumn-woods": 2,
  "misty-bog": 2,
  "craggy-highlands": 3,
  "cursed-ruinlands": 4,
};

export function biomeBaseDangerTier(biome: BiomeKind): DangerTier {
  return BASE_TIERS[biome];
}

export function distanceDangerTier(wx: number, wy: number): DangerTier {
  const r = Math.hypot(wx, wy);
  if (r < TIER_DISTANCES[2]) return 1;
  if (r < TIER_DISTANCES[3]) return 2;
  if (r < TIER_DISTANCES[4]) return 3;
  if (r < TIER_DISTANCES[5]) return 4;
  return 5;
}

export function computeDangerTier(biome: BiomeKind, wx: number, wy: number): DangerTier {
  return Math.max(biomeBaseDangerTier(biome), distanceDangerTier(wx, wy)) as DangerTier;
}

function isCursedRegion(dist: number, ruinNoise: number): boolean {
  if (dist >= TIER_DISTANCES[5] && ruinNoise > 0.38) return true;
  if (dist >= TIER_DISTANCES[4] && ruinNoise > 0.50) return true;
  return dist >= TIER_DISTANCES[3] && ruinNoise > 0.60;
}

function pickOuterBiome(q: { readonly dist: number; readonly temp: number; readonly moist: number; readonly ruinNoise: number }): BiomeKind {
  if (isCursedRegion(q.dist, q.ruinNoise)) return "cursed-ruinlands";
  if (q.dist >= TIER_DISTANCES[2] && q.temp < 0.42 && q.moist < 0.56) return "craggy-highlands";
  if (q.moist > 0.60) return "misty-bog";
  return q.temp > 0.54 ? "autumn-woods" : "verdant-forest";
}

export function sampleMacroBiome(worldSeed: number, wx: number, wy: number): BiomeKind {
  const dist = Math.hypot(wx, wy);
  if (dist < SPAWN_SAFE_BIOME_RADIUS) return "verdant-forest";
  const temp = fbm2d({ seed: worldSeed + 709, x: wx * BIOME_NOISE_FREQ, y: wy * BIOME_NOISE_FREQ, octaves: 3 });
  const moist = fbm2d({ seed: worldSeed + 821, x: wx * BIOME_NOISE_FREQ, y: wy * BIOME_NOISE_FREQ, octaves: 3 });
  const ruinNoise = fbm2d({ seed: worldSeed + 991, x: wx * RUIN_NOISE_FREQ, y: wy * RUIN_NOISE_FREQ, octaves: 2 });
  return pickOuterBiome({ dist, temp, moist, ruinNoise });
}
