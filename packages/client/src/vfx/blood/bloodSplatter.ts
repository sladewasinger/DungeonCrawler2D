// Hit-splatter particle burst: a short one-shot spray of blood-tinted particles at a
// combat hit/death — VISUAL_DIRECTION's "hits feel like hits" + "particles + light, not
// recolored rectangles" rules. Directional when a knockback vector is available
// (bloodDirection.ts), otherwise an even spray. `particle_soft` is the atlas's compact,
// solid particle; the much larger `light_soft` frame belongs to additive illumination
// and washed blood out under the dynamic light layer. Normal alpha blend keeps blood
// opaque without making it glow.
import type Phaser from "phaser";
import { ASSET_KEYS } from "../../boot/assetManifest.js";
import { splatterAngleWindow } from "./bloodDirection.js";
import { COMBAT_PARTICLE_DEPTH } from "../combat/combatLayer.js";

const FRAME = "particle_soft";
const HIT_COUNT = 12;
const DEATH_COUNT = 28;
const PARTICLE_LIFETIME_MS = { min: 450, max: 1_050 };

interface SplatterInput {
  readonly x: number;
  readonly y: number;
  readonly tint: number;
  readonly quantity: number;
  readonly speedMax: number;
  readonly window: { minDeg: number; maxDeg: number };
}

export interface HitSplatterInput {
  readonly x: number;
  readonly y: number;
  readonly tint: number;
  readonly direction?: { x: number; y: number } | undefined;
  readonly intensity?: number;
}

export interface DeathSplatterInput {
  readonly x: number;
  readonly y: number;
  readonly tint: number;
  readonly intensity?: number;
}

export function bloodDropQuantity(baseCount: number, intensity: number): number {
  return Math.round(baseCount * Math.min(1, Math.max(0, intensity)));
}

function fire(scene: Phaser.Scene, { x: screenX, y: screenY, tint, quantity, speedMax, window }: SplatterInput): void {
  if (quantity === 0) return;
  const emitter = scene.add
    .particles(screenX, screenY, ASSET_KEYS.atlas, {
      frame: FRAME,
      lifespan: PARTICLE_LIFETIME_MS,
      speed: { min: speedMax * 0.25, max: speedMax },
      angle: { min: window.minDeg, max: window.maxDeg },
      scale: { start: 1.25, end: 0.3 },
      alpha: { start: 1, end: 0 },
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
export function spawnHitSplatter(scene: Phaser.Scene, {
  x,
  y,
  tint,
  direction,
  intensity = 1,
}: HitSplatterInput): void {
  fire(scene, {
    x, y, tint, quantity: bloodDropQuantity(HIT_COUNT, intensity), speedMax: 95,
    window: splatterAngleWindow(direction?.x, direction?.y),
  });
}

/** Heavier omnidirectional burst for a death. */
export function spawnDeathSplatter(scene: Phaser.Scene, {
  x,
  y,
  tint,
  intensity = 1,
}: DeathSplatterInput): void {
  fire(scene, {
    x, y, tint, quantity: bloodDropQuantity(DEATH_COUNT, intensity), speedMax: 150,
    window: splatterAngleWindow(),
  });
}
