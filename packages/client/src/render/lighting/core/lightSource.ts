// Shared light-source shape + deterministic flicker curves: subtle scale/alpha noise so
// torches/personal light/area glows read as alive without literal randomness — identical
// every run, keyed by a per-source seed so multiple lights don't pulse in lockstep.
import { LIGHTING_VISUAL_STYLE } from "../lightingVisualStyle.js";
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
  /**
   * GROUND-anchored screen shift, in world-height units (`groundAt` at the light's
   * tile) — docs/ELEVATION-PROJECTION.md section 5: "personal halo + torch/door lights
   * use groundAt(tile) so a torch on a platform glows on the platform." Omitted/0 for
   * a light with no ground concept (or not yet plumbed this wave); pool.ts converts it
   * to the same `height*TILE` screen-Y shift every other ground-anchored thing uses.
   */
  readonly groundHeight?: number;
  /** Radius used only by the darkness reveal mask; halo size remains `radiusTiles`. */
  readonly revealRadiusTiles?: number;
  /** Soft darkness-mask brush radius in tile units. */
  readonly revealCellRadiusTiles?: number;
  /** Per-cell darkness erasure strength before LOS falloff. */
  readonly revealCellAlpha?: number;
  /** Small exact-source darkness stamp radius, separate from the LOS field. */
  readonly sourceRevealCellRadiusTiles?: number;
  /** Exact-source darkness erasure strength, separate from the LOS field. */
  readonly sourceRevealCellAlpha?: number;
  /** Marks a non-`torch` source, such as a flying torch, as torch-strength. */
  readonly emitsTorchLight?: boolean;
  /** Optional per-source halo tuning, used by the player light mode. */
  readonly haloAlphaMultiplier?: number;
  readonly haloScaleMultiplier?: number;
}

/** Small integer hash used only to spread flicker phase — not a determinism-sensitive RNG. */
export function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return h >>> 0;
}

const FLICKER = LIGHTING_VISUAL_STYLE.halo;

/** ~0.9..1.1 multiplier from two layered sine waves at different rates — organic, non-repeating flicker. */
export function flickerScale(nowMs: number, seed: number): number {
  const a = Math.sin((nowMs / FLICKER.flickerPeriodMs) * Math.PI * 2 + seed);
  const b = Math.sin(
    (nowMs / (FLICKER.flickerPeriodMs * FLICKER.scaleSecondaryRate)) *
      Math.PI * 2 + seed * 1.7,
  );
  return 1 + a * FLICKER.scalePrimaryAmplitude +
    b * FLICKER.scaleSecondaryAmplitude;
}

/** Alpha companion to flickerScale, phase-shifted so scale and alpha never peak together. */
export function flickerAlpha(nowMs: number, seed: number): number {
  const a = Math.sin(
    (nowMs / FLICKER.flickerPeriodMs) * Math.PI * 2 + seed + 1.3,
  );
  const b = Math.sin(
    (nowMs / (FLICKER.flickerPeriodMs * FLICKER.alphaSecondaryRate)) *
      Math.PI * 2 + seed * 2.1,
  );
  return 1 + a * FLICKER.alphaPrimaryAmplitude +
    b * FLICKER.alphaSecondaryAmplitude;
}
