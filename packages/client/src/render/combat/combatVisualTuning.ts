/** Editable visual combat, melee swing/smear, hitstop, and gore tuning levers. */
import type { GoreStyle, GoreSubstance } from "@dc2d/engine";
import type { ChunkKind } from "./goreTextures.js";

export interface ComboArmSpec {
  readonly sweep: number;
  readonly baseReach: number;
  readonly extReach: number;
  readonly dir: number;
  readonly punch: number;
}

export interface SmearSpec {
  readonly radius: number;
  readonly inner: number;
  readonly span: number;
  readonly fill: number;
  readonly edge: number;
  readonly fillAlpha: number;
  readonly edgeAlpha: number;
  readonly ttl: number;
  readonly dir: number;
}

export interface SubstancePalette {
  readonly fresh: readonly number[];
  readonly dried: readonly number[];
  readonly solid: boolean;
  readonly chunkKind: ChunkKind;
}

export interface GoreStyleTuning {
  readonly count: number;
  readonly streaks: number;
  readonly chunks: number;
  readonly speed: number;
  readonly spread: number;
  readonly minScale: number;
  readonly maxScale: number;
  readonly decalAlpha: number;
  readonly ttlSec: number;
  readonly vz: number;
}

export const MELEE_SWING_TUNING = {
  durationSec: 0.31,
  cooldownSec: 0.25,
  comboWindowSec: 0.68,
  lungeNormalPx: 2.5,
  lungeFinisherPx: 3.8,
  torsoLeanRad: 0.18,
  hitstopHitSec: 0.045,
  hitstopParrySec: 0.055,
  torchFill: 0xf97316,
  torchEdge: 0xfef08a,
  combos: {
    1: { sweep: 1.02, baseReach: 5.6, extReach: 2.6, dir: 1, punch: 0.08 },
    2: { sweep: 1.06, baseReach: 5.8, extReach: 2.8, dir: -1, punch: 0.08 },
    3: { sweep: 1.28, baseReach: 6.4, extReach: 3.4, dir: 1, punch: 0.16 },
  } as Readonly<Record<number, ComboArmSpec>>,
  smears: {
    1: { radius: 21, inner: 11, span: 2.04, fill: 0xbae6fd, edge: 0xffffff, fillAlpha: 0.48, edgeAlpha: 0.92, ttl: 0.28, dir: 1 },
    2: { radius: 22, inner: 11, span: 2.12, fill: 0xe0f2fe, edge: 0xffffff, fillAlpha: 0.48, edgeAlpha: 0.92, ttl: 0.28, dir: -1 },
    3: { radius: 25, inner: 12, span: 2.56, fill: 0xfef08a, edge: 0xffffff, fillAlpha: 0.56, edgeAlpha: 0.96, ttl: 0.32, dir: 1 },
  } as Readonly<Record<number, SmearSpec>>,
} as const;

export const GORE_TUNING = {
  maxDecals: 800,
  maxDroplets: 240,
  gravityPx: 195,
  bleedDripIntervalSec: 0.32,
  decalTtlSec: 150,
  decalFadeSec: 14,
  dryDurationSec: 14,
  palettes: {
    blood: { fresh: [0x9e1b1b, 0xb91c1c, 0x7f1d1d, 0xc82828], dried: [0x4a1216, 0x3b0e12, 0x56161b], solid: false, chunkKind: "soft" },
    slime: { fresh: [0x2f9e44, 0x40c057, 0x2b8a3e, 0x69db7c], dried: [0x245e31, 0x1b4725, 0x2d6a3e], solid: false, chunkKind: "soft" },
    ichor: { fresh: [0x7e22ce, 0x9333ea, 0x6b21a8, 0xa855f7], dried: [0x3b185f, 0x2e124a, 0x481e70], solid: false, chunkKind: "soft" },
    straw: { fresh: [0xd4a017, 0xeab308, 0xa16207, 0xf5d042], dried: [0x9a7514, 0x7a590f, 0xb0861c], solid: true, chunkKind: "straw" },
    bone: { fresh: [0xe2e8f0, 0xcbd5e1, 0xf1f5f9, 0xb8c4d4], dried: [0xb8c0cc, 0x9aa4b2, 0xcbd2dc], solid: true, chunkKind: "bone" },
    stone: { fresh: [0x7c8594, 0x94a3b8, 0x64748b, 0x525d6d], dried: [0x646c7a, 0x4b5563, 0x707988], solid: true, chunkKind: "stone" },
  } as Readonly<Record<GoreSubstance, SubstancePalette>>,
  styles: {
    splatter: { count: 14, streaks: 2, chunks: 1, speed: 58, spread: 1.35, minScale: 0.42, maxScale: 0.72, decalAlpha: 0.84, ttlSec: 150, vz: 34 },
    "thin-streak": { count: 14, streaks: 5, chunks: 1, speed: 84, spread: 0.95, minScale: 0.36, maxScale: 0.62, decalAlpha: 0.86, ttlSec: 150, vz: 22 },
    drip: { count: 4, streaks: 1, chunks: 0, speed: 32, spread: 0.38, minScale: 0.32, maxScale: 0.48, decalAlpha: 0.78, ttlSec: 120, vz: 10 },
    "chunk-spray": { count: 20, streaks: 6, chunks: 6, speed: 78, spread: 1.65, minScale: 0.48, maxScale: 0.84, decalAlpha: 0.88, ttlSec: 150, vz: 52 },
    "explode-away": { count: 28, streaks: 6, chunks: 9, speed: 92, spread: Math.PI * 2, minScale: 0.54, maxScale: 0.92, decalAlpha: 0.9, ttlSec: 150, vz: 64 },
  } as Readonly<Record<GoreStyle, GoreStyleTuning>>,
} as const;
