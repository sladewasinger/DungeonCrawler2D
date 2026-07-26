// Held weapon: the self player's icon orbits live aim while remote players orbit their
// replicated facing angle. Both paths snap through the melee arc on a swing, preserving
// weapon, fist, aim, and block reads for every observer.
import type Phaser from "phaser";
import { ASSET_KEYS, SCREEN_TILE_PX, WORLD_PIXEL_SCALE } from "../../boot/assetManifest.js";
import {
  BLOCK_GUARD_TINT,
  blockGuardTransform,
} from "./blockGuard.js";
import { MELEE_HALF_ANGLE_RAD, orbitPosition, swingSweepAngle } from "./weaponOrbit.js";

const HAND_OFFSET_X = SCREEN_TILE_PX * 0.34;
const HAND_OFFSET_Y = -SCREEN_TILE_PX * 0.45;
const SWING_ARC_DEGREES = 70;

/** Orbit center sits above the feet-anchored screen position, roughly chest height. */
const ORBIT_CENTER_OFFSET_Y = -SCREEN_TILE_PX * 0.5;
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
  /** Live self aim or replicated remote facing angle in radians; null retains the legacy fixed hand-offset for non-player callers. */
  readonly orbitAngleRad: number | null;
  /** Direction (radians) the current/most-recent swing was aimed — the strike sweep's center, matching the wedge telegraph exactly. */
  readonly attackAngleRad: number;
  /** True when `frame` is the unarmed fist fallback, so it gets a skin tint instead of a weapon's bare metal look. */
  readonly isFistFallback: boolean;
}

/**
 * Fraction of a depth-sort row-step (see depthSort.ts's ROW_STEP) added on top of the
 * wielder's own depth so the legacy-mode weapon always draws in front of their body —
 * the hand offset places it squarely inside the body sprite's own bounding box, so
 * without this it renders fully hidden behind the body at any depth tie.
 */
const WEAPON_DEPTH_BIAS = 0.001;

/** Positions the weapon at the wielder's hand or orbit, swinging through the strike telegraph while striking. */
export function updateHeldWeapon(sprite: Phaser.GameObjects.Sprite, frame: string | null, pose: HeldWeaponPose): void {
  if (!frame) {
    sprite.setVisible(false);
    return;
  }
  sprite.setVisible(true);
  sprite.setFrame(frame);
  if (pose.blocking) sprite.setTint(BLOCK_GUARD_TINT);
  else if (pose.isFistFallback) sprite.setTint(FIST_TINT);
  else sprite.clearTint();
  sprite.setScale(WORLD_PIXEL_SCALE);

  if (pose.blocking) {
    positionGuard(sprite, pose);
    return;
  }

  if (pose.orbitAngleRad === null) {
    sprite.setDepth(pose.wielderDepth + WEAPON_DEPTH_BIAS);
    positionLegacyHandOffset(sprite, pose);
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
  const guard = blockGuardTransform(
    pose.screenX,
    pose.screenY + ORBIT_CENTER_OFFSET_Y,
    facingAngle,
    SCREEN_TILE_PX,
    pose.nowMs,
  );
  sprite.setDepth(
    pose.wielderDepth + Math.sin(facingAngle) * WEAPON_DEPTH_BIAS,
  );
  sprite.setFlipX(false);
  sprite.setFlipY(Math.cos(facingAngle) < 0);
  sprite.setPosition(guard.x, guard.y);
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
  // South-ward (positive sin, screen-down) orbit points draw in front of the wielder;
  // north-ward points draw behind — the same "further south draws in front" convention
  // depthSort.ts uses for whole entities, applied at orbit-weapon scale.
  sprite.setDepth(pose.wielderDepth + Math.sin(angle) * WEAPON_DEPTH_BIAS);
  const center = orbitPosition(pose.screenX, pose.screenY + ORBIT_CENTER_OFFSET_Y, angle, SCREEN_TILE_PX);
  sprite.setFlipX(false);
  // On the left half of the orbit a pure rotation renders the weapon upside
  // down; a vertical flip mirrors the blade back upright — the standard ARPG
  // held-weapon treatment (user playtest 2026-07-20).
  sprite.setFlipY(Math.cos(angle) < 0);
  sprite.setPosition(center.x, center.y);
  sprite.setRotation(center.rotation);
}
