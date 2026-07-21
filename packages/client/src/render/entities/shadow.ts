// Ground shadow: a soft dark ellipse glued to an entity's ground position (never its
// airborne/elevated sprite position) — how VISUAL_DIRECTION wants height read: "the
// shadow blob stays glued to the ground — it's how players read z." It also shrinks
// slightly the further an entity is off the ground it's standing on, reinforcing a
// jump's height the same way a real top-down shadow would.
//
// WAVE R2 shadow/ground unification, FLAT-PROJECTION form (user rulings, docs/ROADMAP.md):
// the debug terrain renderer draws every surface at its raw world row (placeDebugTile —
// no north-shift for height), so the ground beneath an entity is ALWAYS drawn at the
// entity's own world position. The shadow therefore sits exactly at the ground-plane
// screen point at every terrain height — no lift term at all — and the sprite joins it
// there whenever grounded (lift.ts lifts only by height ABOVE the local ground). The
// earlier "shadow a tile south of the feet / near the head in a pit" reports were the
// SPRITE floating off its drawn floor via the old absolute-z lift, not the shadow being
// misplaced; with the sprite fixed, shadow-at-world-row is correct by construction.
// Airborne (jump/fall) the sprite rises while the shadow stays put — the one divergence.
import type Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";

const SHADOW_COLOR = 0x0a0a10;
const SHADOW_ALPHA = 0.5;
const SHADOW_WIDTH_FRACTION = 0.7;
const SHADOW_HEIGHT_FRACTION = 0.28;
const SHADOW_Y_OFFSET = -2;
const SHADOW_MIN_SCALE = 0.55;
/** Per world-height-unit of airborne clearance, how much the shadow shrinks. */
const HEIGHT_SCALE_FALLOFF = 0.35;

export function createShadow(scene: Phaser.Scene, depth: number): Phaser.GameObjects.Ellipse {
  return scene.add
    .ellipse(
      0,
      0,
      SCREEN_TILE_PX * SHADOW_WIDTH_FRACTION,
      SCREEN_TILE_PX * SHADOW_HEIGHT_FRACTION,
      SHADOW_COLOR,
      SHADOW_ALPHA,
    )
    .setDepth(depth);
}

/** Shrinks toward SHADOW_MIN_SCALE as `heightAboveGround` grows; 1 (full size) at 0. */
export function shadowScaleForHeight(heightAboveGround: number): number {
  return Math.max(SHADOW_MIN_SCALE, 1 - heightAboveGround * HEIGHT_SCALE_FALLOFF);
}

/** Repositions a shadow at an entity's ground-plane screen position — under flat
 * projection that IS the drawn floor beneath it at every terrain height — scaling it
 * down the further off that ground the entity currently is (0 while standing on it). */
export function updateShadowPosition(
  shadow: Phaser.GameObjects.Ellipse,
  groundScreenX: number,
  groundScreenY: number,
  heightAboveGround = 0,
): void {
  shadow.setPosition(groundScreenX, groundScreenY + SHADOW_Y_OFFSET);
  shadow.setScale(shadowScaleForHeight(heightAboveGround));
}
