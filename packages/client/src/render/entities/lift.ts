// Elevation lift under the ELEVATION-PROJECTION contract (docs/ELEVATION-PROJECTION.md
// section 3): an entity renders lifted on screen by its full ABSOLUTE height z —
// body.z already carries both a platform's terrain height AND any jump/fall on top of
// it (engine/entities/movement) — because terrain surfaces now bake the SAME shift
// (a raised platform's cap draws `h*TILE` screen-up, section 1's surface rule), so a
// grounded entity (z === groundAt) lands exactly on its drawn cap for free: same
// formula, same axis, no separate "flat" special-case. This SUPERSEDES the interim
// flat-projection convention (commit fcb4530, "grounded entities stand ON their
// drawn tiles at every z" via a zero-lift rule) that shipped before terrain itself
// gained a matching shift — with only the entity side flattened, a grounded sprite at
// z1 sat athwart terrain still drawn at its raw row. Reverting the entity math to
// absolute-z is correct precisely BECAUSE wave E2 (terrain surface shift) makes the
// terrain side match it again.
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";

/**
 * Pixels to shift a sprite upward (negative screen Y) for absolute height z. The
 * trailing params are accepted-but-ignored: torchEntityVisual.ts calls this with the
 * old 3-arg shape, and keeping the shape source-compatible means callers don't all
 * need touching in lockstep — the lift itself only ever needs z now. The identical
 * `z*TILE` shape also serves GROUND-anchored callers (shadow/halo/decals): call this
 * with a cell's `groundAt` height instead of an entity's `z` to get the same shifted
 * screen-Y term (docs/ELEVATION-PROJECTION.md section 5).
 */
export function spriteLiftPx(z: number, _groundHeight?: number, _airborne?: boolean): number {
  return z * SCREEN_TILE_PX;
}

/**
 * Height above the entity's own ground tile: the "extra" part of z that comes from
 * jumping or falling, as opposed to standing on elevated terrain (where z sits exactly
 * AT groundHeight). Zero while grounded, since a platform's height is already fully
 * carried by z itself. Still drives the depth same-row tiebreak and the shadow's
 * height-scaling (section 3: "lift is the same-row tiebreak"; section 5: shadow
 * shrinks by airborne clearance even though its POSITION now tracks shifted ground).
 */
export function airborneHeightAboveGround(z: number, groundHeight: number, airborne: boolean): number {
  return airborne ? Math.max(0, z - groundHeight) : 0;
}
