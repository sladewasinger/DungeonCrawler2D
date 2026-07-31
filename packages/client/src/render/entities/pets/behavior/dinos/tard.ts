import type Phaser from "phaser";
import { ASSET_KEYS } from "../../../../../boot/assetManifest.js";
import { worldToScreen } from "../../../geometry/worldToScreen.js";
import type {
  DinoBehaviorSyncInput,
  DinoBehaviorVisual,
} from "../types.js";

export const TARD_FART_PARTICLE_COUNT = 12;

const FART_DEPTH_BIAS = 0.08;
const FART_DURATION_MS = 1_100;
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
    lifespan: FART_DURATION_MS,
    speed: { min: 16, max: 42 },
    angle: { min: 238, max: 302 },
    scale: { start: 1.35, end: 0.22, random: true },
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
  const rear = worldToScreen(
    view.x - view.faceX * 0.42,
    view.y - view.faceY * 0.42,
  );
  emitter
    .setPosition(rear.x, rear.y - 14)
    .setDepth(body.depth + FART_DEPTH_BIAS)
    .setVisible(true)
    .setActive(true);
  emitter.killAll();
  emitter.explode(TARD_FART_PARTICLE_COUNT);
}
