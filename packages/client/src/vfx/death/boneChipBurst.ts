import type Phaser from "phaser";
import { ASSET_KEYS } from "../../boot/assetManifest.js";
import { splatterAngleWindow } from "../blood/bloodDirection.js";
import { COMBAT_PARTICLE_DEPTH } from "../combat/combatLayer.js";

const BONE_TINTS = [0xf3ead2, 0xd8cdb8, 0xb8aa91];
const HIT_CHIP_COUNT = 7;
const DEATH_CHIP_COUNT = 18;
const LIFESPAN_MS = { min: 380, max: 920 };
const HIT_CHIP_SCALE = { start: 1.3, end: 0.35 };
const DEATH_CHIP_SCALE = { start: 0.9, end: 0.18 };

export interface BoneChipBurstInput {
  readonly x: number;
  readonly y: number;
  readonly lethal: boolean;
  readonly direction?: { x: number; y: number } | undefined;
}

export function isSkeletalDefId(defId: string | undefined): boolean {
  return defId === "skeleton" || defId === "warden-of-five";
}

export function spawnBoneChipBurst(scene: Phaser.Scene, {
  x: screenX,
  y: screenY,
  lethal,
  direction,
}: BoneChipBurstInput): void {
  const quantity = lethal ? DEATH_CHIP_COUNT : HIT_CHIP_COUNT;
  const angle = boneChipAngle(lethal, direction);
  const emitter = createBoneChipEmitter(scene, { screenX, screenY, lethal, quantity, angle });
  emitter.explode(quantity);
  scene.time.delayedCall(LIFESPAN_MS.max + 50, () => emitter.destroy());
}

interface BoneChipEmitterInput {
  readonly screenX: number;
  readonly screenY: number;
  readonly lethal: boolean;
  readonly quantity: number;
  readonly angle: { minDeg: number; maxDeg: number };
}

function boneChipAngle(lethal: boolean, direction: BoneChipBurstInput["direction"]) {
  return lethal ? { minDeg: 0, maxDeg: 360 } : splatterAngleWindow(direction?.x, direction?.y);
}

function createBoneChipEmitter(scene: Phaser.Scene, {
  screenX,
  screenY,
  lethal,
  quantity,
  angle,
}: BoneChipEmitterInput) {
  return scene.add
    .particles(screenX, screenY, ASSET_KEYS.atlas, {
      frame: "particle_soft",
      lifespan: LIFESPAN_MS,
      speed: { min: 32, max: lethal ? 145 : 90 },
      angle: { min: angle.minDeg, max: angle.maxDeg },
      scale: lethal ? DEATH_CHIP_SCALE : HIT_CHIP_SCALE,
      alpha: { start: 0.95, end: 0 },
      tint: BONE_TINTS,
      gravityY: 150,
      rotate: { min: 0, max: 360 },
      quantity,
      emitting: false,
    })
    .setName("bone-chip-burst")
    .setDepth(COMBAT_PARTICLE_DEPTH);
}
