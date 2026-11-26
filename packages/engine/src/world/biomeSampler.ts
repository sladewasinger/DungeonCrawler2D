/** Deterministic infinite biome, terrain, elevation, and river sampling. */
import { clamp, fbm2d, hashUnit2d, ridgeNoise2d } from "../math/noise.js";
import { sampleMacroBiome } from "./biomes/macroBiome.js";
import { GroundKind, type BiomeKind } from "./types.js";

const BIOME_VERDANT: BiomeKind = "verdant-forest";
const BIOME_HIGHLANDS: BiomeKind = "craggy-highlands";
const BIOME_CURSED: BiomeKind = "cursed-ruinlands";

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
    biome: BIOME_VERDANT,
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
    biome: BIOME_VERDANT,
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

function sampleWaterOrBank(river: number, variant: number, biome: BiomeKind): TileSample | null {
  if (river < 0.42) {
    return { ground: GroundKind.DeepWater, elevation: 0, stairs: false, biome, forestDensity: 0, variant };
  }
  if (river < 0.74) {
    return { ground: GroundKind.ShallowWater, elevation: 0, stairs: false, biome, forestDensity: 0, variant };
  }
  if (river < 1.02) {
    return { ground: GroundKind.Sand, elevation: 0, stairs: false, biome, forestDensity: 0.05, variant };
  }
  return null;
}

function sampleHighlandGround(hill: number, biome: BiomeKind): Omit<TileSample, "stairs" | "variant"> {
  const craggy = biome === BIOME_HIGHLANDS;
  const rocky = craggy ? GroundKind.SlateRock : GroundKind.CliffStone;
  const soft = craggy ? GroundKind.AshGround : GroundKind.MossStone;
  const ground = hill > 0.84 ? rocky : soft;
  return { ground, elevation: hill > 0.85 ? 2 : 1, biome, forestDensity: 0.22 };
}

type FlatSampler = (biome: BiomeKind, moisture: number) => Omit<TileSample, "stairs" | "variant">;

const BIOME_FLAT_SAMPLERS: Readonly<Record<BiomeKind, FlatSampler>> = {
  "autumn-woods": (biome, moisture) => ({ ground: moisture > 0.5 ? GroundKind.AutumnFloor : GroundKind.AutumnGrass, elevation: 0, biome, forestDensity: 0.65 }),
  "misty-bog": (biome, moisture) => (moisture > 0.78
    ? { ground: GroundKind.ShallowWater, elevation: 0, biome, forestDensity: 0 }
    : { ground: moisture > 0.58 ? GroundKind.BogMud : GroundKind.BogMoss, elevation: 0, biome, forestDensity: 0.45 }),
  [BIOME_HIGHLANDS]: (biome, moisture) => ({ ground: moisture > 0.48 ? GroundKind.SlateRock : GroundKind.AshGround, elevation: 0, biome, forestDensity: 0.25 }),
  [BIOME_CURSED]: (biome, moisture) => ({ ground: moisture > 0.5 ? GroundKind.CursedMoss : GroundKind.RuinFlagstone, elevation: 0, biome, forestDensity: 0.3 }),
  [BIOME_VERDANT]: (biome, moisture) => {
    if (moisture > 0.56) return { ground: GroundKind.ForestFloor, elevation: 0, biome, forestDensity: 0.82 };
    const meadow = moisture < 0.38;
    return { ground: meadow ? GroundKind.MeadowGrass : GroundKind.Grass, elevation: 0, biome, forestDensity: meadow ? 0.25 : 0.55 };
  },
};

function sampleDryGround(input: {
  readonly seed: number; readonly wx: number; readonly wy: number;
  readonly moisture: number; readonly hill: number; readonly biome: BiomeKind;
}): Omit<TileSample, "stairs" | "variant"> {
  if (input.hill > 0.72) return sampleHighlandGround(input.hill, input.biome);
  const trail = Math.abs(fbm2d({ seed: input.seed + 61, x: input.wx * 0.045, y: input.wy * 0.045, octaves: 2 }) - 0.5);
  if (trail < 0.025 && input.hill < 0.65) {
    const pathGround = input.biome === BIOME_CURSED ? GroundKind.RuinFlagstone : GroundKind.DirtPath;
    return { ground: pathGround, elevation: 0, biome: input.biome, forestDensity: 0.08 };
  }
  return BIOME_FLAT_SAMPLERS[input.biome](input.biome, input.moisture);
}

export function sampleWorldTile(seed: number, wx: number, wy: number): TileSample {
  const spawnOverride = spawnClearingSample(wx, wy);
  if (spawnOverride) return spawnOverride;
  const river = riverMetric(seed, wx, wy);
  const variant = Math.floor(hashUnit2d(seed + 5, wx, wy) * 4);
  const macroBiome = sampleMacroBiome(seed, wx, wy);
  const bank = sampleWaterOrBank(river, variant, macroBiome);
  if (bank) return bank;
  const hill = fbm2d({ seed: seed + 109, x: wx * 0.024, y: wy * 0.024, octaves: 4 });
  const moisture = fbm2d({ seed: seed + 211, x: wx * 0.02, y: wy * 0.02, octaves: 3 });
  return { ...sampleDryGround({ seed, wx, wy, moisture, hill, biome: macroBiome }), stairs: false, variant };
}
