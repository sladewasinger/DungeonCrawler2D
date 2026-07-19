// Held weapon: an equip-hand icon that follows the wielder's facing, with a quick swing
// arc during the "strike" telegraph (see animState.ts) — the readable stand-in for
// dedicated attack frames the hero pack doesn't ship.
import type Phaser from "phaser";
import { ASSET_KEYS, SCREEN_TILE_PX } from "../../boot/assetManifest.js";

const HAND_OFFSET_X = SCREEN_TILE_PX * 0.34;
const HAND_OFFSET_Y = -SCREEN_TILE_PX * 0.45;
const SWING_ARC_DEGREES = 70;

export function createHeldWeapon(scene: Phaser.Scene, depth: number): Phaser.GameObjects.Sprite {
  return scene.add.sprite(0, 0, ASSET_KEYS.atlas).setOrigin(0.5, 0.5).setDepth(depth).setVisible(false);
}

export interface HeldWeaponPose {
  readonly screenX: number;
  readonly screenY: number;
  readonly facingX: number;
  readonly striking: boolean;
  /** 0..1 progress through the strike telegraph, driving the swing arc. */
  readonly strikeProgress: number;
  /** The wielder body sprite's current Phaser depth, so the weapon can draw just in front of it. */
  readonly wielderDepth: number;
}

/**
 * Fraction of a depth-sort row-step (see depthSort.ts's ROW_STEP) added on top of the
 * wielder's own depth so the weapon always draws in front of their body — the hand
 * offset places it squarely inside the body sprite's own bounding box, so without this
 * it renders fully hidden behind the body at any depth tie.
 */
const WEAPON_DEPTH_BIAS = 0.001;

/** Positions the weapon at the wielder's hand, flipped to facing, swinging through strikeProgress while striking. */
export function updateHeldWeapon(sprite: Phaser.GameObjects.Sprite, frame: string | null, pose: HeldWeaponPose): void {
  if (!frame) {
    sprite.setVisible(false);
    return;
  }
  sprite.setVisible(true);
  sprite.setFrame(frame);
  sprite.setDepth(pose.wielderDepth + WEAPON_DEPTH_BIAS);
  const facingSign = pose.facingX < 0 ? -1 : 1;
  sprite.setFlipX(facingSign < 0);
  sprite.setPosition(pose.screenX + HAND_OFFSET_X * facingSign, pose.screenY + HAND_OFFSET_Y);
  const swing = pose.striking ? (pose.strikeProgress - 0.5) * SWING_ARC_DEGREES : 0;
  sprite.setAngle(facingSign * swing);
}
