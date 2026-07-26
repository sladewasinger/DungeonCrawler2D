// Hit-splatter particle burst: a short one-shot spray of blood-tinted particles at a
// combat hit/death — VISUAL_DIRECTION's "hits feel like hits" + "particles + light, not
// recolored rectangles" rules. Directional when a knockback vector is available
// (bloodDirection.ts), otherwise an even spray. `particle_soft` is the atlas's compact,
// solid particle; the much larger `light_soft` frame belongs to additive illumination
// and washed blood out under the dynamic light layer. Normal alpha blend keeps blood
// opaque without making it glow.
import type Phaser from "phaser";
import { ASSET_KEYS } from "../boot/assetManifest.js";
import { splatterAngleWindow } from "./bloodDirection.js";
import { COMBAT_PARTICLE_DEPTH } from "./combatLayer.js";

const FRAME = "particle_soft";
const HIT_COUNT = 12;
const DEATH_COUNT = 32;
const PARTICLE_LIFETIME_MS = { min: 450, max: 1_050 };

function fire(
  scene: Phaser.Scene,
  screenX: number,
  screenY: number,
  tint: number,
  quantity: number,
  speedMax: number,
  window: { minDeg: number; maxDeg: number },
): void {
  const emitter = scene.add
    .particles(screenX, screenY, ASSET_KEYS.atlas, {
      frame: FRAME,
      lifespan: PARTICLE_LIFETIME_MS,
      speed: { min: speedMax * 0.25, max: speedMax },
      angle: { min: window.minDeg, max: window.maxDeg },
      scale: { start: 1.25, end: 0.3 },
      alpha: { start: 0.96, end: 0 },
      tint,
      gravityY: 95,
      quantity,
      emitting: false,
    })
    .setDepth(COMBAT_PARTICLE_DEPTH);
  emitter.explode(quantity);
  scene.time.delayedCall(PARTICLE_LIFETIME_MS.max + 50, () => emitter.destroy());
}

/** Small directional (or omnidirectional) spray for a landed hit. */
export function spawnHitSplatter(
  scene: Phaser.Scene,
  screenX: number,
  screenY: number,
  tint: number,
  dirX?: number,
  dirY?: number,
): void {
  fire(
    scene, screenX, screenY, tint, HIT_COUNT, 95,
    splatterAngleWindow(dirX, dirY),
  );
}

/** Heavier omnidirectional burst for a death. */
export function spawnDeathSplatter(
  scene: Phaser.Scene,
  screenX: number,
  screenY: number,
  tint: number,
): void {
  fire(
    scene, screenX, screenY, tint, DEATH_COUNT, 150,
    splatterAngleWindow(),
  );
}
