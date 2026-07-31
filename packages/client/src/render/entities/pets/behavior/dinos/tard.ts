import type Phaser from "phaser";
import { ASSET_KEYS } from "../../../../../boot/assetManifest.js";
import { worldToScreen } from "../../../geometry/worldToScreen.js";
import type { ViewOrientation } from "../../../../view/orientation/viewOrientation.js";
import { getViewOrientation } from "../../../../view/transform/viewState.js";
import { worldToView } from "../../../../view/transform/viewTransform.js";
import type {
  DinoBehaviorSyncInput,
  DinoBehaviorVisual,
} from "../types.js";

export const TARD_FART_PARTICLE_COUNT = 12;
export const TARD_FART_DURATION_MS = 2_200;

const FART_DEPTH_BIAS = 0.08;
/** Fixed point-mode speed gives a roughly 3x longer plume after the doubled lifetime. */
const FART_EJECTION_SPEED_PX = 44;
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
  const velocity = rearwardVelocity(view);
  emitter
    .setPosition(rear.x, rear.y - 14)
    .setDepth(body.depth + FART_DEPTH_BIAS)
    .setVisible(true)
    .setActive(true)
    .setParticleSpeed(velocity.x, velocity.y)
    .setRadial(false);
  emitter.killAll();
  emitter.explode(TARD_FART_PARTICLE_COUNT);
}

interface TardRearwardVelocityInput {
  readonly faceX: number;
  readonly faceY: number;
  readonly orientation: ViewOrientation;
}

export function tardRearwardVelocity(
  input: TardRearwardVelocityInput,
): { x: number; y: number } {
  const rear = worldToView({ x: -input.faceX, y: -input.faceY }, input.orientation);
  const { x, y } = rear;
  const length = Math.hypot(x, y);
  if (length === 0) return { x: 0, y: FART_EJECTION_SPEED_PX };
  return {
    x: x / length * FART_EJECTION_SPEED_PX,
    y: y / length * FART_EJECTION_SPEED_PX,
  };
}

function rearwardVelocity(view: DinoBehaviorSyncInput["view"]): { x: number; y: number } {
  return tardRearwardVelocity({
    faceX: view.faceX,
    faceY: view.faceY,
    orientation: getViewOrientation(),
  });
}
