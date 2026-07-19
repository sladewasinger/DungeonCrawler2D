// Pure geometry + fade curve for the melee-swing wedge telegraph: a pie slice from the
// wielder's position out to the engine's real melee range/arc, so what players see
// matches exactly what the server resolves hits against. Kept Phaser-free (meleeWedge.ts
// does the drawing) so the shape is unit-testable apart from any Graphics object.
import { MELEE_ARC_COS, MELEE_RANGE } from "@dc2d/engine";

/** Wedge radius, in tiles — the engine's real melee reach, not a re-tuned visual guess. */
export const WEDGE_RADIUS_TILES = MELEE_RANGE;

/** Wedge half-angle, in radians — derived from the engine's real melee arc cosine. */
export const WEDGE_HALF_ANGLE_RAD = Math.acos(MELEE_ARC_COS);

/** How long the wedge stays visible, fading out over this window (docs spec: "~160ms"). */
export const WEDGE_FADE_MS = 160;

export interface WedgeGeometry {
  readonly startAngle: number;
  readonly endAngle: number;
  readonly radiusPx: number;
}

/** The wedge's screen-space arc bounds, centered on `centerAngleRad`. */
export function wedgeGeometry(centerAngleRad: number, tilePx: number): WedgeGeometry {
  return {
    startAngle: centerAngleRad - WEDGE_HALF_ANGLE_RAD,
    endAngle: centerAngleRad + WEDGE_HALF_ANGLE_RAD,
    radiusPx: WEDGE_RADIUS_TILES * tilePx,
  };
}

/** 1 at spawn, linearly fading to 0 by WEDGE_FADE_MS; 0 before spawn or once fully faded. */
export function wedgeAlpha(elapsedMs: number): number {
  if (elapsedMs < 0 || elapsedMs >= WEDGE_FADE_MS) return 0;
  return 1 - elapsedMs / WEDGE_FADE_MS;
}
