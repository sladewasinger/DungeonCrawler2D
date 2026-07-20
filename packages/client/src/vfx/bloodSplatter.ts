// Hit-splatter particle burst: a short one-shot spray of blood-tinted particles at a
// combat hit/death — VISUAL_DIRECTION's "hits feel like hits" + "particles + light, not
// recolored rectangles" rules. Directional when a knockback vector is available
// (bloodDirection.ts), otherwise an even spray. Normal alpha blend, not ADD: blood must
// not glow (VISUAL_DIRECTION's "additive restraint"). Deliberately not MULTIPLY either —
// the atlas's only particle frame (`light_soft`) is a sparse, low-density gradient built
// for ADD-blend glow halos (particleRecipes.ts/pool.ts) and reads as near-invisible
// under MULTIPLY (verified live), so plain alpha blending is the reliable choice for a
// short-lived, non-additive burst (ASSUMPTIONS.md #56).
import type Phaser from "phaser";
import { ASSET_KEYS } from "../boot/assetManifest.js";
import { splatterAngleWindow } from "./bloodDirection.js";

const FRAME = "light_soft";
/** Same particle-layer tier as particleRecipes.ts's PARTICLE_LAYER_DEPTH. */
const DEPTH = 210_000;
const HIT_COUNT = 7;
const DEATH_COUNT = 18;

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
      lifespan: { min: 220, max: 420 },
      speed: { min: speedMax * 0.25, max: speedMax },
      angle: { min: window.minDeg, max: window.maxDeg },
      scale: { start: 0.16, end: 0.03 },
      alpha: { start: 0.85, end: 0 },
      tint,
      gravityY: 60,
      quantity,
      emitting: false,
    })
    .setDepth(DEPTH);
  emitter.explode(quantity);
  scene.time.delayedCall(440, () => emitter.destroy());
}

/** Small directional (or omnidirectional) spray for a landed hit. */
export function spawnHitSplatter(scene: Phaser.Scene, screenX: number, screenY: number, tint: number, dirX?: number, dirY?: number): void {
  fire(scene, screenX, screenY, tint, HIT_COUNT, 70, splatterAngleWindow(dirX, dirY));
}

/** Heavier omnidirectional burst for a death. */
export function spawnDeathSplatter(scene: Phaser.Scene, screenX: number, screenY: number, tint: number): void {
  fire(scene, screenX, screenY, tint, DEATH_COUNT, 110, splatterAngleWindow());
}
