// Kill-moment gib burst: a chunkier one-shot particle spray than the ordinary hit/death
// splatter (bloodSplatter.ts) — GRINDER's "damage numbers, hit-flash, screen shake,
// death animation, loot drop" demand needs a kill to read as heavier than a hit.
// Uses the atlas's dedicated solid particle frame; "chunkier" comes from count, size,
// and a stronger gravity arc rather than light-halo art.
import type Phaser from "phaser";
import { ASSET_KEYS } from "../boot/assetManifest.js";
import { COMBAT_PARTICLE_DEPTH } from "./combatLayer.js";

const FRAME = "particle_soft";
/** "24+ particles with gravity" per the wave-7 kill-moment brief. */
export const GIB_PARTICLE_COUNT = 44;
const LIFESPAN_MS = { min: 650, max: 1_600 };
const SPEED_MAX = 190;
/** Heavier than blood's 60/110 gravityY — chunks arc and land, they don't mist away. */
const GRAVITY_Y = 260;

/** Fires a heavy omnidirectional chunk burst at a kill; self-destroys once spent. */
export function spawnGibBurst(
  scene: Phaser.Scene,
  screenX: number,
  screenY: number,
  tint: number,
): void {
  const emitter = scene.add
    .particles(screenX, screenY, ASSET_KEYS.atlas, {
      frame: FRAME,
      lifespan: LIFESPAN_MS,
      speed: { min: SPEED_MAX * 0.2, max: SPEED_MAX },
      angle: { min: 0, max: 360 },
      scale: { start: 1.8, end: 0.45 },
      alpha: { start: 0.98, end: 0 },
      tint: [tint, 0x2a1f1f],
      gravityY: GRAVITY_Y,
      quantity: GIB_PARTICLE_COUNT,
      emitting: false,
    })
    .setName("death-gore-burst")
    .setDepth(COMBAT_PARTICLE_DEPTH + 1);
  emitter.explode(GIB_PARTICLE_COUNT);
  scene.time.delayedCall(LIFESPAN_MS.max + 40, () => emitter.destroy());
}
