// Fistbump-sealed flourish: a gold spark burst plus a brief fist-icon pop over a
// player's head — fired once per side when a mutual contact is sealed (Epic 7.10).
// Mirrors pickupGlint.ts's self-contained, self-destroying one-shot pattern rather
// than mutating the entity renderer's own hit-flash/nameplate objects, so this stays
// decoupled from that tightly-coupled render pipeline (see ASSUMPTIONS.md).
import type Phaser from "phaser";
import { ASSET_KEYS } from "../boot/assetManifest.js";
import { uiTextStyle } from "../ui/font.js";

const GLINT_COLOR = 0xffd23d;
const FLOURISH_DEPTH = 400_001;
const PARTICLE_COUNT = 10;
const ICON_LIFESPAN_MS = 600;

/** One-shot celebratory spark burst + fist-icon pop at a screen position; self-destroys once spent. */
export function spawnFistbumpFlourish(scene: Phaser.Scene, screenX: number, screenY: number): void {
  spawnSparkBurst(scene, screenX, screenY);
  spawnFistIcon(scene, screenX, screenY);
}

function spawnSparkBurst(scene: Phaser.Scene, screenX: number, screenY: number): void {
  const emitter = scene.add
    .particles(screenX, screenY, ASSET_KEYS.atlas, {
      frame: "light_soft",
      lifespan: 460,
      speed: { min: 30, max: 90 },
      scale: { start: 0.22, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: GLINT_COLOR,
      quantity: PARTICLE_COUNT,
      blendMode: "ADD",
      emitting: false,
    })
    .setDepth(FLOURISH_DEPTH);
  emitter.explode(PARTICLE_COUNT);
  scene.time.delayedCall(500, () => emitter.destroy());
}

function spawnFistIcon(scene: Phaser.Scene, screenX: number, screenY: number): void {
  const icon = scene.add
    .text(screenX, screenY, "✊", uiTextStyle(20, "#ffd23d"))
    .setOrigin(0.5, 1)
    .setDepth(FLOURISH_DEPTH + 1);
  scene.tweens.add({
    targets: icon,
    y: screenY - 24,
    scale: { from: 0.4, to: 1.3 },
    alpha: { from: 1, to: 0 },
    duration: ICON_LIFESPAN_MS,
    ease: "Cubic.Out",
    onComplete: () => icon.destroy(),
  });
}
