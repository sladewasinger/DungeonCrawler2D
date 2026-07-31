import type Phaser from "phaser";
import { ASSET_KEYS, WORLD_PIXEL_SCALE } from "../../../boot/assetManifest.js";
import { createHeldWeapon } from "../combat/weapon/heldWeapon.js";
import { createShadow } from "../geometry/shadow.js";
import { createHpBar } from "../presentation/hpBar.js";
import { createNameplate } from "../presentation/nameplate.js";
import type { MonsterVisual } from "./state.js";

export function createMonsterVisual(
  scene: Phaser.Scene,
  spritePrefix: string,
  trainingWeaponId?: string,
): MonsterVisual {
  const body = scene.add.sprite(0, 0, ASSET_KEYS.atlas)
    .setOrigin(0.5, 1)
    .setScale(WORLD_PIXEL_SCALE);
  const visual = baseMonsterVisual(scene, body, spritePrefix);
  const weapon = trainingWeaponId ? createHeldWeapon(scene, 0) : undefined;
  return weapon && trainingWeaponId
    ? { ...visual, weapon, trainingWeaponId }
    : visual;
}

function baseMonsterVisual(
  scene: Phaser.Scene,
  body: Phaser.GameObjects.Sprite,
  spritePrefix: string,
): MonsterVisual {
  return {
    kind: "enemy",
    body,
    shadow: createShadow(scene, 0),
    hpBar: createHpBar(scene, 0),
    nameplate: createNameplate(scene, 0),
    spritePrefix,
    lastHp: undefined,
    hpBarRevealed: false,
    lastFx: [],
    hitFlashStartMs: undefined,
    lastAnim: undefined,
    telegraphStartMs: undefined,
  };
}
