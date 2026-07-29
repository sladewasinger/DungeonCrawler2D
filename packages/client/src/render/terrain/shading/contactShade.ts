// Tunable ambient-occlusion parameters for the procedural terrain overlay.
import { TERRAIN_VISUAL_STYLE } from "../terrainVisualStyle.js";

/** AO gradient strength, 0..1 — Austin's dial (docs/ASSUMPTIONS.md row 361). */
export const DEFAULT_AO_STRENGTH = TERRAIN_VISUAL_STYLE.ambientOcclusion.defaultStrength;

let aoStrength = DEFAULT_AO_STRENGTH;

/**
 * Overrides the AO strength. CONTRACT: only `scenes/editor`'s lighting panel
 * may call this (same process-wide editor-preview-only rule as
 * tileLight.ts's setTileLightConfig) — live play always bakes at
 * DEFAULT_AO_STRENGTH.
 */
export function setAOStrength(value: number): void {
  aoStrength = Math.min(1, Math.max(0, value));
}

/** The strength the next chunk bake will shade with. */
export function getAOStrength(): number {
  return aoStrength;
}

/** Nested band widths (fraction of a tile, all starting at the casting edge):
 * stacking three translucent rects composes a stepped gradient — darkest in
 * the innermost overlap zone, faintest at the outer feather. */
export const AO_BAND_FRACS = TERRAIN_VISUAL_STYLE.ambientOcclusion.bandFractions;
/** Per-band alpha at strength 1; each scales linearly with the knob. */
const AO_BAND_ALPHAS = TERRAIN_VISUAL_STYLE.ambientOcclusion.bandAlphas;
/** Corner-patch square size (fraction of a tile) and its strength-1 alpha. */
export const AO_CORNER_FRAC = TERRAIN_VISUAL_STYLE.ambientOcclusion.cornerFraction;
const AO_CORNER_ALPHA = TERRAIN_VISUAL_STYLE.ambientOcclusion.cornerAlpha;

/** The three nested band alphas at `strength` (0 -> all invisible). */
export function aoBandAlphas(strength: number): [number, number, number] {
  return [
    (AO_BAND_ALPHAS[0] ?? 0) * strength,
    (AO_BAND_ALPHAS[1] ?? 0) * strength,
    (AO_BAND_ALPHAS[2] ?? 0) * strength,
  ];
}

/** The corner patch's alpha at `strength`. */
export function aoCornerAlpha(strength: number): number {
  return AO_CORNER_ALPHA * strength;
}
