import type Phaser from "phaser";
import { SCREEN_TILE_PX, WORLD_PIXEL_SCALE } from "../../../../boot/assetManifest.js";
import { depthForCombatOverlay } from "../../presentation/depthSort.js";
import { hammerStrikeTransform } from "./hammerStrike.js";

export interface HammerWeaponPose {
  readonly screenX: number;
  readonly screenY: number;
  readonly attackAngleRad: number;
  readonly strikeProgress: number;
  readonly wielderDepth: number;
  readonly wielderViewY: number;
}

export function positionHammerWeaponStrike(
  sprite: Phaser.GameObjects.Sprite,
  pose: HammerWeaponPose,
): void {
  const transform = hammerStrikeTransform({
    screenX: pose.screenX,
    screenY: pose.screenY,
    attackAngleRad: pose.attackAngleRad,
    progress: pose.strikeProgress,
    tilePx: SCREEN_TILE_PX,
  });
  sprite.setFlipX(false).setFlipY(Math.cos(transform.rotation) < 0);
  sprite.setPosition(transform.x, transform.y);
  sprite.setRotation(transform.rotation);
  sprite.setScale(WORLD_PIXEL_SCALE * transform.scale);
  sprite.setDepth(transform.behindWielder
    ? pose.wielderDepth - 0.1
    : depthForCombatOverlay(pose));
}
