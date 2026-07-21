// Ground shadow: a soft dark ellipse glued to an entity's GROUND position (never its
// airborne/elevated sprite position) — how VISUAL_DIRECTION wants height read: "the
// shadow blob stays glued to the ground — it's how players read z." It also shrinks
// slightly the further an entity is off the ground it's standing on, reinforcing a
// jump's height the same way a real top-down shadow would.
//
// ELEVATION-PROJECTION contract (docs/ELEVATION-PROJECTION.md section 5): "GROUND-
// anchored things sit at worldToScreen(x,y).y - groundAt(x,y)*TILE." Terrain now bakes
// that same shift into its own drawn surface (wave E2), so the caller passes this
// module the entity's SHIFTED ground screen point (worldToScreen(...).y minus the
// local groundAt height in pixels — see lift.ts's spriteLiftPx reused for that term),
// not the raw unshifted worldToScreen output — this module itself stays position-
// agnostic, just placing whatever ground point it's handed. Grounded, that shifted
// ground point coincides with the sprite's own absolute-z lift (lift.ts), so shadow
// and body sit together on the drawn cap at every terrain height, exactly like the
// personal-light halo already did. Airborne (jump/fall) the sprite rises above that
// point while the shadow stays put and shrinks (heightAboveGround) — the one
// divergence, unchanged from every prior wave.
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

/** Repositions a shadow at an entity's (already-shifted) ground-plane screen position —
 * that IS the drawn floor beneath it at every terrain height (section 5) — scaling it
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
