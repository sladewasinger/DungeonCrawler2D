import type { Entity } from "../../entities/entity.js";
import {
  combatHurtboxBounds,
  verticalRangeIntersectsHurtbox,
} from "../geometry/hurtboxes.js";
import {
  diskIntersectsBounds,
  sectorIntersectsBounds,
  sectorIntersectsCircle,
  type Bounds2,
} from "./sectorIntersection.js";
import type { WeaponProfile } from "./weaponProfiles.js";
import { WEAPON_HITBOX_TUNING } from "./weaponHitboxTuning.js";

type HitboxGeometry = Pick<WeaponProfile, "arcCos" | "range" | "shape">;

interface WeaponHitboxInput {
  readonly attacker: Pick<Entity, "body">;
  readonly direction: { readonly x: number; readonly y: number };
  readonly profile: HitboxGeometry;
}

export interface WeaponHitboxPointInput extends WeaponHitboxInput {
  readonly point: { readonly x: number; readonly y: number; readonly z: number };
  readonly pointRadius: number;
}

export interface WeaponHitboxHurtboxInput extends WeaponHitboxInput {
  readonly target: Pick<Entity, "body" | "kind" | "combatHurtbox">;
}

/** True when a circular physical volume intersects the canonical weapon hitbox. */
export function weaponHitboxContainsPoint(input: WeaponHitboxPointInput): boolean {
  if (!withinWeaponProjectileHeight(input)) return false;
  const center = {
    x: input.point.x - input.attacker.body.x,
    y: input.point.y - input.attacker.body.y,
  };
  if (input.profile.shape === "ground") {
    return Math.hypot(center.x, center.y) <=
      input.profile.range + input.pointRadius;
  }
  return sectorIntersectsCircle({
    ...input.profile,
    direction: input.direction,
  }, center, input.pointRadius);
}

function withinWeaponProjectileHeight(input: WeaponHitboxPointInput): boolean {
  const range = weaponHitboxVerticalRange(input.attacker.body.z);
  return input.point.z + input.pointRadius >= range.minimumZ &&
    input.point.z - input.pointRadius <= range.maximumZ;
}

export interface WeaponHitboxVerticalRange {
  readonly minimumZ: number;
  readonly maximumZ: number;
}

export function weaponHitboxVerticalRange(attackerZ: number): WeaponHitboxVerticalRange {
  const centerZ = attackerZ + WEAPON_HITBOX_TUNING.strikeHeightOffset;
  return {
    minimumZ: centerZ - WEAPON_HITBOX_TUNING.verticalHalfExtent,
    maximumZ: centerZ + WEAPON_HITBOX_TUNING.verticalHalfExtent,
  };
}

/** True when the authoritative weapon hitbox intersects a target hurtbox. */
export function weaponHitboxIntersectsHurtbox(
  input: WeaponHitboxHurtboxInput,
): boolean {
  if (!withinWeaponHeight(input.attacker.body.z, input.target)) return false;
  const bounds = relativeHurtboxBounds(input);
  if (input.profile.shape === "ground") {
    return diskIntersectsBounds(input.profile.range, bounds);
  }
  return sectorIntersectsBounds({
    ...input.profile,
    direction: input.direction,
  }, bounds);
}

function relativeHurtboxBounds(input: WeaponHitboxHurtboxInput): Bounds2 {
  const bounds = combatHurtboxBounds(input.target);
  return {
    minX: bounds.minX - input.attacker.body.x,
    maxX: bounds.maxX - input.attacker.body.x,
    minY: bounds.minY - input.attacker.body.y,
    maxY: bounds.maxY - input.attacker.body.y,
  };
}

function withinWeaponHeight(
  attackerZ: number,
  target: WeaponHitboxHurtboxInput["target"],
): boolean {
  const range = weaponHitboxVerticalRange(attackerZ);
  return verticalRangeIntersectsHurtbox(
    range.minimumZ,
    range.maximumZ,
    target,
  );
}
