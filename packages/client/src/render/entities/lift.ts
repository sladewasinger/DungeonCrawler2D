// Airborne sprite lift: entities float upward on screen while jumping, but plant exactly
// on their ground shadow once grounded — matches EntitySnapshot's `air` flag semantics
// ("present iff airborne — grounded entities render planted on their shadow").
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";

/** Pixels to shift a sprite upward (negative screen Y) for its height above ground; 0 unless airborne. */
export function spriteLiftPx(z: number, groundHeight: number, airborne: boolean): number {
  if (!airborne) return 0;
  return Math.max(0, z - groundHeight) * SCREEN_TILE_PX;
}
