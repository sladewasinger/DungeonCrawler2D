import type Phaser from "phaser";
import { ASSET_KEYS } from "../../../../../boot/assetManifest.js";
import type {
  DinoBehaviorSyncInput,
  DinoBehaviorVisual,
} from "../types.js";

export const TARD_FART_PARTICLE_COUNT = 12;
export const TARD_FART_DURATION_MS = 2_200;

const FART_DEPTH_BIAS = 0.08;
const FART_EJECTION_SPEED_PX = 20;
const FART_REAR_OFFSET_PX = 14;
const FART_PARTICLE_TINTS = [0x9bd45d, 0x6fae45, 0xb5df67];

export function createTardBehaviorVisual(
  scene: Phaser.Scene,
): DinoBehaviorVisual {
  const fart = createFartEmitter(scene);
  let lastEvent = 0;
  return {
    sync(input): void {
      if (input.view.petBehaviorEvent === lastEvent) return;
      lastEvent = input.view.petBehaviorEvent;
      if (input.view.petBehavior === "toot") {
        emitFart(fart, input);
      }
    },
    destroy: () => fart.destroy(),
  };
}

function createFartEmitter(
  scene: Phaser.Scene,
): Phaser.GameObjects.Particles.ParticleEmitter {
  return scene.add.particles(0, 0, ASSET_KEYS.atlas, {
    frame: "particle_soft",
    lifespan: TARD_FART_DURATION_MS,
    scale: { start: 4.05, end: 0.66, random: true },
    alpha: { start: 0.88, end: 0 },
    tint: FART_PARTICLE_TINTS,
    quantity: TARD_FART_PARTICLE_COUNT,
    emitting: false,
    blendMode: "NORMAL",
  }).setVisible(false);
}

function emitFart(
  emitter: Phaser.GameObjects.Particles.ParticleEmitter,
  input: DinoBehaviorSyncInput,
): void {
  const { view, body } = input;
  const facingSign = screenFacingSign(view.faceX);
  const velocity = tardRearwardVelocity(view.faceX);
  emitter
    .setPosition(
      body.x - facingSign * FART_REAR_OFFSET_PX,
      body.y - FART_REAR_OFFSET_PX,
    )
    .setDepth(body.depth + FART_DEPTH_BIAS)
    .setVisible(true)
    .setActive(true)
    .setParticleSpeed(velocity.x, velocity.y)
    .setRadial(false);
  emitter.killAll();
  emitter.explode(TARD_FART_PARTICLE_COUNT);
}

export function tardRearwardVelocity(
  faceX: number,
): { x: number; y: number } {
  return {
    x: -screenFacingSign(faceX) * FART_EJECTION_SPEED_PX,
    y: 0,
  };
}

function screenFacingSign(faceX: number): -1 | 1 {
  return faceX < 0 ? -1 : 1;
}
