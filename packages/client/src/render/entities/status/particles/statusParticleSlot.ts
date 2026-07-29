import Phaser from "phaser";
import {
  FIRE_SPARK_PARTICLE,
  OIL_DROP_PARTICLE,
  POISON_GAS_PARTICLE,
  fireSparkVerticalOffset,
  oilVerticalOffset,
  particleAlpha,
  particleProgress,
  poisonGasVerticalOffset,
  statusParticleNoise,
  type StatusParticleKind,
} from "./statusParticleMotion.js";
import {
  statusParticlePresentation,
} from "./statusParticlePresentation.js";
import type { StatusVisualFrame } from "../statusVisualFrame.js";

export interface StatusParticleSlot {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly kind: StatusParticleKind;
  active: boolean;
  startedAtMs: number;
  offsetX: number;
  driftX: number;
  verticalBias: number;
  sequence: number;
}

export interface StatusParticleActivation {
  readonly body: Phaser.GameObjects.Sprite;
  readonly nowMs: number;
  readonly seed: number;
  readonly sequence: number;
}

interface StatusParticleGeometry {
  readonly body: Phaser.GameObjects.Sprite;
  readonly horizontalNoise: number;
  readonly verticalNoise: number;
}

export function createStatusParticleSlot(
  scene: Phaser.Scene,
  kind: StatusParticleKind,
): StatusParticleSlot {
  const recipe = statusParticlePresentation(kind, 0);
  const sprite = scene.add
    .sprite(0, 0, recipe.texture, recipe.frame)
    .setOrigin(0.5)
    .setVisible(false)
    .setActive(false);
  return {
    sprite,
    kind,
    active: false,
    startedAtMs: 0,
    offsetX: 0,
    driftX: 0,
    verticalBias: 0,
    sequence: 0,
  };
}

export function activateStatusParticleSlot(
  slot: StatusParticleSlot,
  input: StatusParticleActivation,
): void {
  const recipe = statusParticlePresentation(slot.kind, input.sequence);
  const horizontalNoise = statusParticleNoise(input.seed, input.sequence);
  const verticalNoise = statusParticleNoise(
    input.seed ^ 0x6c8e9cf5,
    input.sequence,
  );
  slot.active = true;
  slot.sequence = input.sequence;
  slot.startedAtMs = input.nowMs;
  configureGeometry(slot, {
    body: input.body,
    horizontalNoise,
    verticalNoise,
  });
  slot.sprite
    .setTint(recipe.tint)
    .setBlendMode(Phaser.BlendModes[recipe.blendMode])
    .setScale(recipe.scaleX, recipe.scaleY)
    .setAlpha(recipe.alpha)
    .setVisible(true)
    .setActive(true);
}

export function syncStatusParticleSlot(
  slot: StatusParticleSlot,
  body: Phaser.GameObjects.Sprite,
  frame: StatusVisualFrame,
): void {
  if (!slot.active) return;
  const recipe = statusParticlePresentation(slot.kind, slot.sequence);
  const progress = particleProgress(
    frame.nowMs,
    slot.startedAtMs,
    recipe.lifespanMs,
  );
  if (progress >= 1) return deactivateStatusParticleSlot(slot);
  const groundDistance = frame.groundScreenY - body.y;
  const yOffset = verticalOffset(slot, progress, body.displayHeight);
  const oilLanding = slot.kind === OIL_DROP_PARTICLE
    ? oilVerticalOffset(progress, body.displayHeight, groundDistance)
    : yOffset + slot.verticalBias;
  const drift = slot.kind === OIL_DROP_PARTICLE ? 0 : slot.driftX * progress;
  const pulse = slot.kind === POISON_GAS_PARTICLE ? 0.8 + progress * 0.5 : 1;
  slot.sprite
    .setPosition(body.x + slot.offsetX + drift, body.y + oilLanding)
    .setDepth(body.depth + recipe.depthBias)
    .setScale(recipe.scaleX * pulse, recipe.scaleY * pulse)
    .setAlpha(recipe.alpha * particleAlpha(slot.kind, progress));
}

export function deactivateStatusParticleSlot(slot: StatusParticleSlot): void {
  slot.active = false;
  slot.sprite.setVisible(false).setActive(false).setAlpha(0);
}

function configureGeometry(
  slot: StatusParticleSlot,
  input: StatusParticleGeometry,
): void {
  const gas = slot.kind === POISON_GAS_PARTICLE;
  const spread = gas ? 1.3 : 0.55;
  const drift = gas ? 0.8 : 0.35;
  slot.offsetX = (input.horizontalNoise - 0.5) *
    input.body.displayWidth * spread;
  slot.driftX = (0.5 - input.horizontalNoise) *
    input.body.displayWidth * drift;
  slot.verticalBias = gas
    ? (input.verticalNoise - 0.5) * input.body.displayHeight * 0.72
    : 0;
}

function verticalOffset(
  slot: StatusParticleSlot,
  progress: number,
  bodyHeight: number,
): number {
  if (slot.kind === FIRE_SPARK_PARTICLE) {
    return fireSparkVerticalOffset(progress, bodyHeight);
  }
  if (slot.kind === POISON_GAS_PARTICLE) {
    return poisonGasVerticalOffset(progress, bodyHeight);
  }
  return 0;
}
