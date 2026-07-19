// Phaser glue for a flying projectile: rotates to its velocity (angle math in
// projectileMotion.ts, pure and unit-tested there) and trails a soft ember-colored
// particle wake so it reads as a moving object, not a sliding icon.
import type Phaser from "phaser";
import { ASSET_KEYS } from "../../boot/assetManifest.js";
import { velocityAngleDegrees } from "./projectileMotion.js";

const TRAIL_TINT = 0xfff2d8;

export function createProjectileTrail(scene: Phaser.Scene, depth: number): Phaser.GameObjects.Particles.ParticleEmitter {
  return scene.add
    .particles(0, 0, ASSET_KEYS.atlas, {
      frame: "coin_anim_f0",
      lifespan: 220,
      speed: 4,
      scale: { start: 0.35, end: 0 },
      alpha: { start: 0.6, end: 0 },
      tint: TRAIL_TINT,
      frequency: 40,
      quantity: 1,
    })
    .setDepth(depth);
}

/** Points the sprite along (vx, vy) and keeps the trail emitter glued to its current position. */
export function updateProjectileMotion(
  sprite: Phaser.GameObjects.Sprite,
  trail: Phaser.GameObjects.Particles.ParticleEmitter,
  x: number,
  y: number,
  vx: number,
  vy: number,
): void {
  sprite.setPosition(x, y);
  sprite.setAngle(velocityAngleDegrees(vx, vy));
  trail.setPosition(x, y);
}
