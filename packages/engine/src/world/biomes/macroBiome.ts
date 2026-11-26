/** Deterministic low-frequency 5-biome macro sampling and frontier DangerTier scaling. */
import { clamp, fbm2d } from "../../math/noise.js";
import type { BiomeKind, DangerTier } from "../types.js";

export const SPAWN_SAFE_BIOME_RADIUS = 28;
const CURSED_FRONTIER_RADIUS = 70;

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
  if (r < 48) return 1;
  if (r < 112) return 2;
  if (r < 192) return 3;
  return 4;
}

export function computeDangerTier(biome: BiomeKind, wx: number, wy: number): DangerTier {
  const base = BASE_TIERS[biome];
  const dist = distanceDangerTier(wx, wy);
  return clamp(Math.max(dist, base), 1, 4) as DangerTier;
}

function isCursedRegion(dist: number, ruinNoise: number): boolean {
  return (dist > CURSED_FRONTIER_RADIUS && ruinNoise > 0.64) || (dist > 110 && ruinNoise > 0.56);
}

function pickOuterBiome(q: { readonly dist: number; readonly temp: number; readonly moist: number; readonly ruinNoise: number }): BiomeKind {
  if (isCursedRegion(q.dist, q.ruinNoise)) return "cursed-ruinlands";
  if (q.temp < 0.36 && q.moist < 0.52) return "craggy-highlands";
  if (q.moist > 0.62) return "misty-bog";
  return q.temp > 0.56 ? "autumn-woods" : "verdant-forest";
}

export function sampleMacroBiome(worldSeed: number, wx: number, wy: number): BiomeKind {
  const dist = Math.hypot(wx, wy);
  if (dist < SPAWN_SAFE_BIOME_RADIUS) return "verdant-forest";
  const temp = fbm2d({ seed: worldSeed + 709, x: wx * 0.0085, y: wy * 0.0085, octaves: 3 });
  const moist = fbm2d({ seed: worldSeed + 821, x: wx * 0.0085, y: wy * 0.0085, octaves: 3 });
  const ruinNoise = fbm2d({ seed: worldSeed + 991, x: wx * 0.009, y: wy * 0.009, octaves: 2 });
  return pickOuterBiome({ dist, temp, moist, ruinNoise });
}
