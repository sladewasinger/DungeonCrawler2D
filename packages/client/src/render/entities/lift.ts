// Elevation lift under the debug renderer's FLAT PROJECTION: terrain draws every
// surface — raised platform tops included — at its raw world row (placeDebugTile;
// height is conveyed by faces/shading/outlines, never by shifting geometry north).
// A grounded entity therefore renders AT its world position, exactly like the tile
// it stands on, and lifts only by the height it is off its own local ground
// (jumping/falling/flying). The previous rule lifted by full absolute z — a holdover
// from the retired pack-art renderer whose caps DID shift north — which floated every
// grounded entity at z!=0 one-z off its drawn floor ("my character and shadow are
// floating on the side of the wall... they should be where the white glow is" — the
// unlifted personal-light halo was the only anchor drawn correctly; user playtest
// 2026-07-20, seed 228182761 x13 y-46 z1).
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";

/**
 * Pixels to shift a sprite upward (negative screen Y): the entity's height ABOVE its
 * local ground only. Grounded (z == groundHeight) => 0. The `airborne` param is
 * accepted for source-compat with older 3-arg call sites; the max(0, ...) already
 * yields 0 for every grounded case without branching on it.
 */
export function spriteLiftPx(z: number, groundHeight = 0, _airborne?: boolean): number {
  return Math.max(0, z - groundHeight) * SCREEN_TILE_PX;
}

/**
 * Height above the entity's own ground tile: the "extra" part of z that comes from
 * jumping or falling, as opposed to standing on elevated terrain. Zero while grounded.
 * Drives the depth same-row tie-break, the shadow's height-scaling, and (identically,
 * post flat-projection) the sprite lift itself.
 */
export function airborneHeightAboveGround(z: number, groundHeight: number, airborne: boolean): number {
  return airborne ? Math.max(0, z - groundHeight) : 0;
}
