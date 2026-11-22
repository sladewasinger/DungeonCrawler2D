/** Editable visual combat, melee swing/smear, hitstop, and gore tuning levers. */
import type { GoreStyle, GoreSubstance } from "@dc2d/engine";

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

export interface GoreStyleTuning {
  readonly count: number;
  readonly speed: number;
  readonly spread: number;
  readonly minR: number;
  readonly maxR: number;
  readonly stretch: number;
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
  maxDecals: 200,
  maxDroplets: 140,
  gravityPx: 165,
  bleedDripIntervalSec: 0.34,
  decalFadeSec: 6,
  palettes: {
    blood: [0x991b1b, 0xb91c1c, 0x7f1d1d, 0xef4444],
    slime: [0x22c55e, 0x4ade80, 0x15803d, 0x86efac],
    ichor: [0xa855f7, 0xc084fc, 0x6b21a8, 0xe879f9],
    straw: [0xeab308, 0xfacc15, 0xa16207, 0xfef08a],
    bone: [0xe2e8f0, 0xcbd5e1, 0x94a3b8, 0xf8fafc],
  } as Readonly<Record<GoreSubstance, readonly number[]>>,
  styles: {
    splatter: { count: 9, speed: 46, spread: 1.15, minR: 1.0, maxR: 2.2, stretch: 1.35, decalAlpha: 0.78, ttlSec: 45, vz: 26 },
    "thin-streak": { count: 7, speed: 68, spread: 0.36, minR: 0.8, maxR: 1.3, stretch: 2.8, decalAlpha: 0.82, ttlSec: 42, vz: 14 },
    drip: { count: 2, speed: 9, spread: 3.1, minR: 0.8, maxR: 1.2, stretch: 1.0, decalAlpha: 0.72, ttlSec: 30, vz: 4 },
    "chunk-spray": { count: 14, speed: 62, spread: 1.45, minR: 1.2, maxR: 2.8, stretch: 1.7, decalAlpha: 0.84, ttlSec: 52, vz: 38 },
    "explode-away": { count: 24, speed: 82, spread: Math.PI * 2, minR: 1.3, maxR: 3.1, stretch: 2.0, decalAlpha: 0.86, ttlSec: 55, vz: 50 },
  } as Readonly<Record<GoreStyle, GoreStyleTuning>>,
} as const;
