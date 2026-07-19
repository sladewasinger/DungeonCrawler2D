// Movement particles: dust puffs on jump/land/turn, footstep motes while sprinting —
// VISUAL_DIRECTION's "movement feel" rule. Both are one-shot bursts, not tracked
// emitters, so callers just fire-and-forget per motion event.
import type Phaser from "phaser";
import { ASSET_KEYS } from "../boot/assetManifest.js";

const FRAME = "light_soft";
/** Above every terrain/entity depth, below the darkness overlay — matches particleRecipes.ts's PARTICLE_LAYER_DEPTH. */
const PARTICLE_DEPTH = 210_000;
const DUST_TINT = 0xb8b8c8;
const MOTE_TINT = 0xd8d0b0;

/** A small ground-hugging dust puff at a screen position — jump push-off, landing impact, or a sharp turn. */
export function spawnDustPuff(scene: Phaser.Scene, screenX: number, screenY: number, quantity = 6): void {
  const emitter = scene.add
    .particles(screenX, screenY, ASSET_KEYS.atlas, {
      frame: FRAME,
      lifespan: 300,
      speed: { min: 10, max: 40 },
      scale: { start: 0.12, end: 0 },
      alpha: { start: 0.5, end: 0 },
      tint: DUST_TINT,
      gravityY: -20,
      quantity,
      emitting: false,
    })
    .setDepth(PARTICLE_DEPTH);
  emitter.explode(quantity);
  scene.time.delayedCall(320, () => emitter.destroy());
}

/** A single faint footstep mote at a sprinting foot's screen position. */
export function spawnFootstepMote(scene: Phaser.Scene, screenX: number, screenY: number): void {
  const emitter = scene.add
    .particles(screenX, screenY, ASSET_KEYS.atlas, {
      frame: FRAME,
      lifespan: 220,
      speed: { min: 4, max: 12 },
      scale: { start: 0.06, end: 0 },
      alpha: { start: 0.35, end: 0 },
      tint: MOTE_TINT,
      quantity: 1,
      emitting: false,
    })
    .setDepth(PARTICLE_DEPTH);
  emitter.explode(1);
  scene.time.delayedCall(240, () => emitter.destroy());
}
