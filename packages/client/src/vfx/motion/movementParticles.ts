// Movement particles: event bursts for jump/land/turn, continuous dust while running,
// and cadence-based motes while walking — VISUAL_DIRECTION's "movement feel" rule.
import type Phaser from "phaser";
import { ASSET_KEYS } from "../../boot/assetManifest.js";

const SOFT_FRAME = "light_soft";
const DUST_FRAME = "chunk_square";
/** Above every terrain/entity depth, below the darkness overlay — matches particleRecipes.ts's PARTICLE_LAYER_DEPTH. */
const PARTICLE_DEPTH = 210_000;
const DUST_TINT = 0x777777;
const MOTE_TINT = 0xd8d0b0;
const DUST_SPREAD_PX = 25;
const DUST_LIFESPAN_MIN_MS = 220;
const DUST_LIFESPAN_MAX_MS = 380;
const DUST_CLEANUP_DELAY_MS = DUST_LIFESPAN_MAX_MS + 40;
const RUN_DUST_LIFESPAN_MS = 400;
const RUN_DUST_CLEANUP_DELAY_MS = RUN_DUST_LIFESPAN_MS - 40;

export interface ParticlePosition {
  readonly x: number;
  readonly y: number;
}

interface DustPuffInput extends ParticlePosition {
  readonly quantity?: number;
}

/** A small ground-hugging dust puff at a screen position — jump push-off, landing impact, or a sharp turn. */
export function spawnDustPuff(scene: Phaser.Scene, {
  x: screenX,
  y: screenY,
  quantity = 6,
}: DustPuffInput): void {
  const emitter = scene.add
    .particles(screenX, screenY, ASSET_KEYS.particleAtlas, {
      frame: DUST_FRAME,
      lifespan: { min: DUST_LIFESPAN_MIN_MS, max: DUST_LIFESPAN_MAX_MS },
      speed: { min: 10, max: 40 },
      angle: { min: 200, max: 340 },
      x: { min: -DUST_SPREAD_PX, max: DUST_SPREAD_PX },
      y: { min: -DUST_SPREAD_PX * 0.3, max: DUST_SPREAD_PX * 0.3 },
      scale: { start: 1, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: DUST_TINT,
      gravityY: -20,
      quantity,
      emitting: false,
    })
    .setDepth(PARTICLE_DEPTH);
  emitter.explode(quantity);
  scene.time.delayedCall(DUST_CLEANUP_DELAY_MS, () => emitter.destroy());
}

/** Emits one low dust chunk at the runner's current world position. */
export function spawnRunDust(scene: Phaser.Scene, { x: screenX, y: screenY }: ParticlePosition): void {
  const emitter = scene.add
    .particles(screenX, screenY, ASSET_KEYS.particleAtlas, {
      frame: DUST_FRAME,
      lifespan: RUN_DUST_LIFESPAN_MS,
      speed: { min: 6, max: 22 },
      scale: { start: 1, end: 2 },
      alpha: { start: 0.9, end: 0 },
      tint: DUST_TINT,
      gravityY: -10,
      quantity: 1,
      emitting: false,
    })
    .setDepth(PARTICLE_DEPTH);
  emitter.explode(1);
  scene.time.delayedCall(RUN_DUST_CLEANUP_DELAY_MS, () => emitter.destroy());
}

/** A single faint footstep mote at a sprinting foot's screen position. */
export function spawnFootstepMote(scene: Phaser.Scene, { x: screenX, y: screenY }: ParticlePosition): void {
  const emitter = scene.add
    .particles(screenX, screenY, ASSET_KEYS.atlas, {
      frame: SOFT_FRAME,
      lifespan: 220,
      speed: { min: 4, max: 12 },
      scale: { start: 0.75, end: 0 },
      alpha: { start: 0.7, end: 0 },
      tint: MOTE_TINT,
      quantity: 1,
      emitting: false,
    })
    .setDepth(PARTICLE_DEPTH);
  emitter.explode(1);
  scene.time.delayedCall(240, () => emitter.destroy());
}
