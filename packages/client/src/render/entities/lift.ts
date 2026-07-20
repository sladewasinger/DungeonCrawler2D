// Elevation lift: an entity renders lifted on screen by its full absolute height z —
// body.z already carries both a platform's terrain height AND any jump/fall on top of
// it (see engine/entities/movement), so standing on a z1 platform lifts a full tile
// with no separate "airborne" branch, and a jump arc adds further height on the same
// axis. Previously this only applied while airborne, which is why standing on raised
// terrain rendered with zero visual lift (docs/ROADMAP.md Epic 7.13).
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";

/**
 * Pixels to shift a sprite upward (negative screen Y) for absolute height z. The
 * trailing params are accepted-but-ignored: torchEntityVisual.ts (a different lane's
 * file) calls this with the old 3-arg shape, and keeping the shape source-compatible
 * means the fix doesn't require touching a file outside this lane — the lift itself
 * only ever needs z now.
 */
export function spriteLiftPx(z: number, _groundHeight?: number, _airborne?: boolean): number {
  return z * SCREEN_TILE_PX;
}

/**
 * Height above the entity's own ground tile: the "extra" part of z that comes from
 * jumping or falling, as opposed to standing on elevated terrain (where z sits exactly
 * AT groundHeight). Zero while grounded, since a platform's height is already fully
 * carried by z itself. Drives the depth same-row tie-break and the shadow's
 * height-scaling — both want "how far off the ground I'm standing on", not the raw z.
 */
export function airborneHeightAboveGround(z: number, groundHeight: number, airborne: boolean): number {
  return airborne ? Math.max(0, z - groundHeight) : 0;
}
