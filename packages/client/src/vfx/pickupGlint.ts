// Item pickup glint: a brief burst of gold sparkle particles — VISUAL_DIRECTION's
// "items on the ground bob and glint" juice, fired at the moment of pickup.
import type Phaser from "phaser";
import { ASSET_KEYS } from "../boot/assetManifest.js";

const GLINT_COLOR = 0xffd23d;
const GLINT_DEPTH = 400_000;
const GLINT_COUNT = 8;

/** Fires a short one-shot burst of gold particles at a screen position; the emitter self-destroys once spent. */
export function spawnPickupGlint(scene: Phaser.Scene, screenX: number, screenY: number): void {
  const emitter = scene.add
    .particles(screenX, screenY, ASSET_KEYS.atlas, {
      frame: "light_soft",
      lifespan: 380,
      speed: { min: 20, max: 60 },
      scale: { start: 0.18, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: GLINT_COLOR,
      quantity: GLINT_COUNT,
      blendMode: "ADD",
      emitting: false,
    })
    .setDepth(GLINT_DEPTH);
  emitter.explode(GLINT_COUNT);
  scene.time.delayedCall(400, () => emitter.destroy());
}
