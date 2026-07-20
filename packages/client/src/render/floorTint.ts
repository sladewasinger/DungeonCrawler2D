/**
 * Per-floor ambient palette tint (Epic 7.14 §5): a small multiplier table over the
 * existing warm/cool tileLight constants — floor 2 cooler, 3 greener, 4 redder, 5
 * near-black-warm. Knob-level, pure data + a getter so it's unit-testable on its own.
 *
 * DEVIATION (docs/ASSUMPTIONS.md #12x): render/terrain/tileLight.ts (WARM_R/G/B,
 * COOL_R/G/B, AMBIENT) is outside this lane's ownership (worldgen/terrain lane's
 * files) — this table is ready for that lane to multiply in at LEVEL_TINTS build
 * time, keyed by the connected floor, but isn't wired into the actual bake yet.
 */
export interface FloorTintMultiplier {
  /** Multiplies WARM_R/G/B. */
  readonly warm: readonly [number, number, number];
  /** Multiplies COOL_R/G/B. */
  readonly cool: readonly [number, number, number];
  /** Multiplies AMBIENT (the unlit-tile floor brightness). */
  readonly ambient: number;
}

const NEUTRAL: FloorTintMultiplier = { warm: [1, 1, 1], cool: [1, 1, 1], ambient: 1 };

const FLOOR_TINTS: readonly FloorTintMultiplier[] = [
  NEUTRAL, // Floor 1: unmodified baseline.
  { warm: [0.94, 0.98, 1.08], cool: [0.92, 0.98, 1.15], ambient: 1 }, // Floor 2: cooler.
  { warm: [0.92, 1.08, 0.9], cool: [0.88, 1.12, 0.92], ambient: 1 }, // Floor 3: greener.
  { warm: [1.1, 0.9, 0.85], cool: [1.08, 0.88, 0.85], ambient: 1 }, // Floor 4: redder.
  { warm: [1.05, 0.82, 0.75], cool: [0.85, 0.75, 0.72], ambient: 0.8 }, // Floor 5: near-black-warm.
];

/** Floors past the authored table hold at the deepest (floor 5) tint. */
export function floorTintMultiplier(floor: number): FloorTintMultiplier {
  const index = Math.min(Math.max(floor, 1), FLOOR_TINTS.length) - 1;
  return FLOOR_TINTS[index] ?? NEUTRAL;
}
