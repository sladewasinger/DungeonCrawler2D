// Shared light-source shape + deterministic flicker curves: subtle scale/alpha noise so
// torches/personal light/area glows read as alive without literal randomness — identical
// every run, keyed by a per-source seed so multiple lights don't pulse in lockstep.
export type LightKind = "torch" | "personal" | "fire" | "poison" | "steam" | "portal";

export interface LightSource {
  readonly id: string;
  /** World tile units (continuous), not screen pixels. */
  readonly x: number;
  readonly y: number;
  readonly color: number;
  readonly radiusTiles: number;
  readonly kind: LightKind;
  /** Per-source phase offset so identical lights don't flicker in sync. */
  readonly seed: number;
}

/** Small integer hash used only to spread flicker phase — not a determinism-sensitive RNG. */
export function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return h >>> 0;
}

const FLICKER_PERIOD_MS = 2200;

/** ~0.9..1.1 multiplier from two layered sine waves at different rates — organic, non-repeating flicker. */
export function flickerScale(nowMs: number, seed: number): number {
  const a = Math.sin((nowMs / FLICKER_PERIOD_MS) * Math.PI * 2 + seed);
  const b = Math.sin((nowMs / (FLICKER_PERIOD_MS * 0.37)) * Math.PI * 2 + seed * 1.7);
  return 1 + (a * 0.06 + b * 0.04);
}

/** Alpha companion to flickerScale, phase-shifted so scale and alpha never peak together. */
export function flickerAlpha(nowMs: number, seed: number): number {
  const a = Math.sin((nowMs / FLICKER_PERIOD_MS) * Math.PI * 2 + seed + 1.3);
  const b = Math.sin((nowMs / (FLICKER_PERIOD_MS * 0.53)) * Math.PI * 2 + seed * 2.1);
  return 1 + (a * 0.08 + b * 0.05);
}
