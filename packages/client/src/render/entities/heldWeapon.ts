// Held weapon: the self player's icon orbits live aim while remote players orbit their
// replicated facing angle. Both paths snap through the melee arc on a swing, preserving
// weapon, fist, aim, and block reads for every observer.
import type Phaser from "phaser";
import { ASSET_KEYS, SCREEN_TILE_PX, WORLD_PIXEL_SCALE } from "../../boot/assetManifest.js";
import {
  BLOCK_GUARD_TINT,
  blockGuardTransform,
} from "./blockGuard.js";
import { combatOriginY, MELEE_HALF_ANGLE_RAD, orbitPosition, swingSweepAngle } from "./weaponOrbit.js";
import { depthForAdjacentTerrainOverlay } from "./depthSort.js";

const HAND_OFFSET_X = SCREEN_TILE_PX * 0.34;
const HAND_OFFSET_Y = -SCREEN_TILE_PX * 0.45;
const SWING_ARC_DEGREES = 70;

/** Tinted-knuckle fallback tint for the unarmed fist stand-in (weaponIcon.ts's FIST_FALLBACK_FRAME). */
const FIST_TINT = 0xd9a066;

export function createHeldWeapon(scene: Phaser.Scene, depth: number): Phaser.GameObjects.Sprite {
  // WORLD_PIXEL_SCALE matches every other entity sprite — without it the weapon
  // draws at raw 16px source size and reads as a sliver (user playtest 2026-07-20).
  return scene.add
    .sprite(0, 0, ASSET_KEYS.atlas)
    .setOrigin(0.5, 0.5)
    .setScale(WORLD_PIXEL_SCALE)
    .setDepth(depth)
    .setVisible(false);
}

export interface HeldWeaponPose {
  readonly screenX: number;
  readonly screenY: number;
  readonly facingX: number;
  readonly striking: boolean;
  readonly blocking: boolean;
  readonly nowMs: number;
  /** 0..1 progress through the strike telegraph, driving the swing arc/sweep. */
  readonly strikeProgress: number;
  /** The wielder body sprite's current Phaser depth, so the weapon can draw near it. */
  readonly wielderDepth: number;
  /** Continuous view-space feet row used by the weapon's one-row presentation lift. */
  readonly wielderViewY: number;
  /** Higher floor immediately screen-south must occlude the weapon. */
  readonly screenSouthFloorHigher: boolean;
  /** Live self aim or replicated remote facing angle in radians; null retains the legacy fixed hand-offset for non-player callers. */
  readonly orbitAngleRad: number | null;
  /** Direction (radians) the current/most-recent swing was aimed — the strike sweep's center, matching the wedge telegraph exactly. */
  readonly attackAngleRad: number;
  /** True when `frame` is the unarmed fist fallback, so it gets a skin tint instead of a weapon's bare metal look. */
  readonly isFistFallback: boolean;
}

/** Positions the weapon at the wielder's hand or orbit, swinging through the strike telegraph while striking. */
export function updateHeldWeapon(sprite: Phaser.GameObjects.Sprite, frame: string | null, pose: HeldWeaponPose): void {
  if (!frame) {
    sprite.setVisible(false);
    return;
  }
  prepareHeldWeapon(sprite, frame, pose);
  positionHeldWeapon(sprite, pose);
}

function prepareHeldWeapon(sprite: Phaser.GameObjects.Sprite, frame: string, pose: HeldWeaponPose): void {
  sprite.setVisible(true).setFrame(frame).setScale(WORLD_PIXEL_SCALE);
  applyHeldWeaponTint(sprite, pose);
}

function applyHeldWeaponTint(sprite: Phaser.GameObjects.Sprite, pose: HeldWeaponPose): void {
  if (pose.blocking) {
    sprite.setTint(BLOCK_GUARD_TINT);
    return;
  }
  if (pose.isFistFallback) {
    sprite.setTint(FIST_TINT);
    return;
  }
  sprite.clearTint();
}

function positionHeldWeapon(sprite: Phaser.GameObjects.Sprite, pose: HeldWeaponPose): void {
  if (pose.blocking) {
    positionGuard(sprite, pose);
    return;
  }

  if (pose.orbitAngleRad === null) {
    positionLegacyHandOffset(sprite, pose);
    setWeaponDepth(sprite, pose);
    return;
  }
  positionOrbiting(sprite, pose);
}

function positionGuard(
  sprite: Phaser.GameObjects.Sprite,
  pose: HeldWeaponPose,
): void {
  const facingAngle = pose.orbitAngleRad ??
    (pose.facingX < 0 ? Math.PI : 0);
  const guard = blockGuardTransform({
    centerX: pose.screenX,
    centerY: combatOriginY(pose.screenY, SCREEN_TILE_PX),
    facingAngle,
    tilePx: SCREEN_TILE_PX,
    nowMs: pose.nowMs,
  });
  sprite.setFlipX(false);
  sprite.setFlipY(Math.cos(facingAngle) < 0);
  sprite.setPosition(guard.x, guard.y);
  setWeaponDepth(sprite, pose);
  sprite.setRotation(guard.rotation);
  sprite.setScale(WORLD_PIXEL_SCALE * guard.scale);
}

/** Legacy fixed hand offset retained for callers that do not provide an orbit angle. */
function positionLegacyHandOffset(sprite: Phaser.GameObjects.Sprite, pose: HeldWeaponPose): void {
  const facingSign = pose.facingX < 0 ? -1 : 1;
  sprite.setFlipX(facingSign < 0);
  sprite.setPosition(pose.screenX + HAND_OFFSET_X * facingSign, pose.screenY + HAND_OFFSET_Y);
  const swing = pose.striking ? (pose.strikeProgress - 0.5) * SWING_ARC_DEGREES : 0;
  sprite.setAngle(facingSign * swing);
}

/** Floats on the orbit circle at the available aim/facing angle, sweeping across the melee wedge while striking. */
function positionOrbiting(sprite: Phaser.GameObjects.Sprite, pose: HeldWeaponPose): void {
  const angle = pose.striking
    ? swingSweepAngle(pose.attackAngleRad, MELEE_HALF_ANGLE_RAD, pose.strikeProgress)
    : (pose.orbitAngleRad as number);
  const center = orbitPosition({
    centerX: pose.screenX,
    centerY: combatOriginY(pose.screenY, SCREEN_TILE_PX),
    angle,
    tilePx: SCREEN_TILE_PX,
  });
  setWeaponDepth(sprite, pose);
  sprite.setFlipX(false);
  // On the left half of the orbit a pure rotation renders the weapon upside
  // down; a vertical flip mirrors the blade back upright — the standard ARPG
  // held-weapon treatment (user playtest 2026-07-20).
  sprite.setFlipY(Math.cos(angle) < 0);
  sprite.setPosition(center.x, center.y);
  sprite.setRotation(center.rotation);
}

/**
 * Weapon screen position includes the absolute-z lift, but Phaser depth does
 * not. Keep the sword in front of the player's immediate screen-south floor
 * cap/wall layer so the blade reads cleanly over its own surrounding tile and
 * the adjacent camera-facing wall, while the following row can still occlude it.
 */
function setWeaponDepth(sprite: Phaser.GameObjects.Sprite, pose: HeldWeaponPose): void {
  const overlayDepth = depthForAdjacentTerrainOverlay(
    pose.wielderViewY,
    pose.wielderDepth,
    pose.screenSouthFloorHigher,
  );
  sprite.setDepth(overlayDepth);
}
