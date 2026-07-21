// Fake ambient occlusion at height discontinuities (docs/ROADMAP.md POLISH
// item "fake ambient occlusion on ALL edges" + PANEL ROUND 3b blocker #3's
// rim/drop-shadow treatment): the LOW floor beside any wall base or cliff drop
// carries a soft baked contact-shadow gradient hugging that edge, interior
// corners darken where two such edges meet (their bands overlap-multiply), and
// a diagonal-only higher neighbor gets a small corner patch so the shadow
// wraps platform corners without a gap. THIRD consumer of the shared cliff
// mask facts (cliffMask.ts's module-doc list: drawTopEdges outlines the HIGH
// side, entities/occlusion.ts occludes, this darkens the LOW side) — same
// world-space height threshold, same TerrainRead surface, so a rotated view
// feeding the view-space proxy (viewWorld.ts) gets screen-correct sides for
// free, exactly like the outlines. Pure facts + tunable strength here; the
// actual rects live in drawContactShade.ts (gradients, not textures — the
// approved debug style).
import { TILE } from "@dc2d/engine";
import { isCliffDrop, type CliffSides } from "./cliffMask.js";
import type { TerrainRead } from "./faces.js";

/** AO gradient strength, 0..1 — Austin's dial (docs/ASSUMPTIONS.md row 361). */
export const DEFAULT_AO_STRENGTH = 0.5;

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

export interface ContactCorners {
  readonly nw: boolean;
  readonly ne: boolean;
  readonly sw: boolean;
  readonly se: boolean;
}

export interface ContactShade {
  /** Orthogonal neighbors high enough over this tile to cast a contact band. */
  readonly sides: CliffSides;
  /** Diagonal-ONLY casters (neither flanking side casts) — small corner patches. */
  readonly corners: ContactCorners;
}

/**
 * A neighbor casts onto this tile when it is a Wall (solid mass always reads
 * as above the floor at its base, whatever its painted height — the editor's
 * flat-height walls included) or open ground a full cliff drop higher
 * (isCliffDrop, the one shared threshold — sub-STEP_UP ramps stay shadeless
 * exactly as they stay faceless/outline-less).
 */
function casts(world: TerrainRead, h: number, nx: number, ny: number): boolean {
  if (world.tileAt(nx, ny) === TILE.Wall) return true;
  return isCliffDrop(world.heightAt(nx, ny), h);
}

/** Which sides/corners of (wx, wy) receive baked contact shade. */
export function contactShadeAt(world: TerrainRead, wx: number, wy: number): ContactShade {
  const h = world.heightAt(wx, wy);
  const north = casts(world, h, wx, wy - 1);
  const south = casts(world, h, wx, wy + 1);
  const east = casts(world, h, wx + 1, wy);
  const west = casts(world, h, wx - 1, wy);
  return {
    sides: { north, south, east, west },
    corners: {
      nw: !north && !west && casts(world, h, wx - 1, wy - 1),
      ne: !north && !east && casts(world, h, wx + 1, wy - 1),
      sw: !south && !west && casts(world, h, wx - 1, wy + 1),
      se: !south && !east && casts(world, h, wx + 1, wy + 1),
    },
  };
}

/** Nested band widths (fraction of a tile, all starting at the casting edge):
 * stacking three translucent rects composes a stepped gradient — darkest in
 * the innermost overlap zone, faintest at the outer feather. */
export const AO_BAND_FRACS = [0.16, 0.3, 0.46] as const;
/** Per-band alpha at strength 1; each scales linearly with the knob. */
const AO_BAND_ALPHAS = [0.3, 0.2, 0.12] as const;
/** Corner-patch square size (fraction of a tile) and its strength-1 alpha. */
export const AO_CORNER_FRAC = 0.3;
const AO_CORNER_ALPHA = 0.22;

/** The three nested band alphas at `strength` (0 -> all invisible). */
export function aoBandAlphas(strength: number): [number, number, number] {
  return [AO_BAND_ALPHAS[0] * strength, AO_BAND_ALPHAS[1] * strength, AO_BAND_ALPHAS[2] * strength];
}

/** The corner patch's alpha at `strength`. */
export function aoCornerAlpha(strength: number): number {
  return AO_CORNER_ALPHA * strength;
}
