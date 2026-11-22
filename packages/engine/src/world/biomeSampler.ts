/** Deterministic infinite biome, terrain, elevation, and river sampling. */
import { clamp, fbm2d, hashUnit2d, ridgeNoise2d } from "../math/noise.js";
import { GroundKind, type BiomeKind } from "./types.js";

const BIOME_GLADE: BiomeKind = "verdant-glade";
const BIOME_RIVER: BiomeKind = "riverbank";

export interface TileSample {
  readonly ground: GroundKind;
  readonly elevation: number;
  readonly stairs: boolean;
  readonly biome: BiomeKind;
  readonly forestDensity: number;
  readonly variant: number;
}

function hashVariant(wx: number, wy: number): number {
  return Math.floor(hashUnit2d(701, wx, wy) * 4);
}

function inSpawnHighland(wx: number, wy: number): boolean {
  return wx >= -13 && wx <= -7 && wy >= -13 && wy <= -7;
}

function spawnHighlandSample(wx: number, wy: number): TileSample {
  const isStairs = wx >= -10 && wx <= -9 && wy === -7;
  return {
    ground: isStairs ? GroundKind.CliffStone : GroundKind.MossStone,
    elevation: isStairs ? 0 : 1,
    stairs: isStairs,
    biome: "highland-ridge",
    forestDensity: 0.15,
    variant: hashVariant(wx, wy),
  };
}

function spawnClearingSample(wx: number, wy: number): TileSample | null {
  if (inSpawnHighland(wx, wy)) return spawnHighlandSample(wx, wy);
  if (Math.hypot(wx, wy) >= 7.2) return null;
  const pathArc = Math.abs(wy - Math.sin(wx * 0.25) * 1.6);
  const nearFire = Math.hypot(wx - 2.5, wy + 1.5) < 2.2;
  const isPath = pathArc < 1.1 || nearFire;
  return {
    ground: isPath ? GroundKind.DirtPath : GroundKind.MeadowGrass,
    elevation: 0,
    stairs: false,
    biome: BIOME_GLADE,
    forestDensity: 0.05,
    variant: hashVariant(wx, wy),
  };
}

function riverMetric(seed: number, wx: number, wy: number): number {
  const shiftX = fbm2d({ seed: seed + 17, x: wx * 0.032, y: wy * 0.032, octaves: 3 }) * 6.5;
  const shiftY = fbm2d({ seed: seed + 31, x: wx * 0.032, y: wy * 0.032, octaves: 3 }) * 6.5;
  const waveRiver = Math.abs(wx - 11 - Math.sin((wy + shiftY) * 0.11) * 5.5);
  const globalRidge = ridgeNoise2d({ seed: seed + 43, x: (wx + shiftX) * 0.018, y: (wy + shiftY) * 0.018, octaves: 3 });
  const nearOriginMask = clamp((Math.hypot(wx - 11, wy) - 18) / 14, 0, 1);
  return Math.min(waveRiver / 3.4, (1 - globalRidge) * 8 + nearOriginMask * 0.35);
}

function sampleWaterOrBank(river: number, variant: number): TileSample | null {
  if (river < 0.42) {
    return { ground: GroundKind.DeepWater, elevation: 0, stairs: false, biome: BIOME_RIVER, forestDensity: 0, variant };
  }
  if (river < 0.74) {
    return { ground: GroundKind.ShallowWater, elevation: 0, stairs: false, biome: BIOME_RIVER, forestDensity: 0, variant };
  }
  if (river < 1.02) {
    return { ground: GroundKind.Sand, elevation: 0, stairs: false, biome: BIOME_RIVER, forestDensity: 0.05, variant };
  }
  return null;
}

function sampleHighlandGround(hill: number): Omit<TileSample, "stairs" | "variant"> {
  const ground = hill > 0.84 ? GroundKind.CliffStone : GroundKind.MossStone;
  return { ground, elevation: hill > 0.85 ? 2 : 1, biome: "highland-ridge", forestDensity: 0.2 };
}

function sampleFlatGround(moisture: number): Omit<TileSample, "stairs" | "variant"> {
  if (moisture > 0.56) {
    return { ground: GroundKind.ForestFloor, elevation: 0, biome: "deep-forest", forestDensity: 0.82 };
  }
  const meadow = moisture < 0.38;
  return { ground: meadow ? GroundKind.MeadowGrass : GroundKind.Grass, elevation: 0, biome: BIOME_GLADE, forestDensity: meadow ? 0.25 : 0.55 };
}

function sampleDryGround(input: {
  readonly seed: number;
  readonly wx: number;
  readonly wy: number;
  readonly moisture: number;
  readonly hill: number;
}): Omit<TileSample, "stairs" | "variant"> {
  if (input.hill > 0.72) return sampleHighlandGround(input.hill);
  const trail = Math.abs(fbm2d({ seed: input.seed + 61, x: input.wx * 0.045, y: input.wy * 0.045, octaves: 2 }) - 0.5);
  if (trail < 0.025 && input.hill < 0.65) {
    return { ground: GroundKind.DirtPath, elevation: 0, biome: BIOME_GLADE, forestDensity: 0.08 };
  }
  return sampleFlatGround(input.moisture);
}

export function sampleWorldTile(seed: number, wx: number, wy: number): TileSample {
  const spawnOverride = spawnClearingSample(wx, wy);
  if (spawnOverride) return spawnOverride;
  const river = riverMetric(seed, wx, wy);
  const variant = Math.floor(hashUnit2d(seed + 5, wx, wy) * 4);
  const bank = sampleWaterOrBank(river, variant);
  if (bank) return bank;
  const hill = fbm2d({ seed: seed + 109, x: wx * 0.024, y: wy * 0.024, octaves: 4 });
  const moisture = fbm2d({ seed: seed + 211, x: wx * 0.02, y: wy * 0.02, octaves: 3 });
  return { ...sampleDryGround({ seed, wx, wy, moisture, hill }), stairs: false, variant };
}
