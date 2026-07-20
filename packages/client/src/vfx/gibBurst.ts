// Kill-moment gib burst: a chunkier one-shot particle spray than the ordinary hit/death
// splatter (bloodSplatter.ts) — GRINDER's "damage numbers, hit-flash, screen shake,
// death animation, loot drop" demand needs a kill to read as heavier than a hit. Same
// atlas-frame/blend-mode constraints as bloodSplatter.ts (only `light_soft` reads under
// alpha blend; see its header comment) — "chunkier" comes from particle count, size,
// and a stronger gravity arc rather than new art.
import type Phaser from "phaser";
import { ASSET_KEYS } from "../boot/assetManifest.js";

const FRAME = "light_soft";
/** Same particle-layer tier as particleRecipes.ts's PARTICLE_LAYER_DEPTH. */
const DEPTH = 210_000;
/** "24+ particles with gravity" per the wave-7 kill-moment brief. */
export const GIB_PARTICLE_COUNT = 28;
const LIFESPAN_MS = { min: 320, max: 620 };
const SPEED_MAX = 160;
/** Heavier than blood's 60/110 gravityY — chunks arc and land, they don't mist away. */
const GRAVITY_Y = 260;

/** Fires a heavy omnidirectional chunk burst at a kill; self-destroys once spent. */
export function spawnGibBurst(scene: Phaser.Scene, screenX: number, screenY: number, tint: number): void {
  const emitter = scene.add
    .particles(screenX, screenY, ASSET_KEYS.atlas, {
      frame: FRAME,
      lifespan: LIFESPAN_MS,
      speed: { min: SPEED_MAX * 0.2, max: SPEED_MAX },
      angle: { min: 0, max: 360 },
      scale: { start: 0.26, end: 0.05 },
      alpha: { start: 0.9, end: 0 },
      tint: [tint, 0x2a1f1f],
      gravityY: GRAVITY_Y,
      quantity: GIB_PARTICLE_COUNT,
      emitting: false,
    })
    .setDepth(DEPTH);
  emitter.explode(GIB_PARTICLE_COUNT);
  scene.time.delayedCall(LIFESPAN_MS.max + 40, () => emitter.destroy());
}
