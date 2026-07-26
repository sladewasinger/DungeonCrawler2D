import type Phaser from "phaser";
import { ASSET_KEYS } from "../boot/assetManifest.js";
import { splatterAngleWindow } from "./bloodDirection.js";
import { COMBAT_PARTICLE_DEPTH } from "./combatLayer.js";

const BONE_TINTS = [0xf3ead2, 0xd8cdb8, 0xb8aa91];
const HIT_CHIP_COUNT = 7;
const DEATH_CHIP_COUNT = 18;
const LIFESPAN_MS = { min: 380, max: 920 };

export function isSkeletalDefId(defId: string | undefined): boolean {
  return defId === "skeleton" || defId === "warden-of-five";
}

export function spawnBoneChipBurst(
  scene: Phaser.Scene,
  screenX: number,
  screenY: number,
  lethal: boolean,
  dirX?: number,
  dirY?: number,
): void {
  const quantity = lethal ? DEATH_CHIP_COUNT : HIT_CHIP_COUNT;
  const angle = lethal
    ? { minDeg: 0, maxDeg: 360 }
    : splatterAngleWindow(dirX, dirY);
  const emitter = scene.add
    .particles(screenX, screenY, ASSET_KEYS.atlas, {
      frame: "particle_soft",
      lifespan: LIFESPAN_MS,
      speed: { min: 32, max: lethal ? 145 : 90 },
      angle: { min: angle.minDeg, max: angle.maxDeg },
      scale: { start: lethal ? 0.9 : 0.65, end: 0.18 },
      alpha: { start: 0.95, end: 0 },
      tint: BONE_TINTS,
      gravityY: 150,
      rotate: { min: 0, max: 360 },
      quantity,
      emitting: false,
    })
    .setName("bone-chip-burst")
    .setDepth(COMBAT_PARTICLE_DEPTH);
  emitter.explode(quantity);
  scene.time.delayedCall(LIFESPAN_MS.max + 50, () => emitter.destroy());
}
