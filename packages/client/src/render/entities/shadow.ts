// Ground shadow: a soft dark ellipse glued to an entity's ground position (never its
// airborne sprite position) — how VISUAL_DIRECTION wants height read: "the shadow blob
// stays glued to the ground — it's how players read z".
import type Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";

const SHADOW_COLOR = 0x0a0a10;
const SHADOW_ALPHA = 0.5;
const SHADOW_WIDTH_FRACTION = 0.7;
const SHADOW_HEIGHT_FRACTION = 0.28;
const SHADOW_Y_OFFSET = -2;

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

/** Repositions a shadow at an entity's ground-plane screen position. */
export function updateShadowPosition(shadow: Phaser.GameObjects.Ellipse, groundScreenX: number, groundScreenY: number): void {
  shadow.setPosition(groundScreenX, groundScreenY + SHADOW_Y_OFFSET);
}
