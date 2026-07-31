import type { Entity } from "../../entities/entity.js";
import { combatHurtboxBounds } from "../geometry/hurtboxes.js";
import {
  diskIntersectsBounds,
  sectorIntersectsBounds,
  sectorIntersectsCircle,
  type Bounds2,
} from "./sectorIntersection.js";
import type { WeaponProfile } from "./weaponProfiles.js";

type AttackGeometry = Pick<WeaponProfile, "arcCos" | "range" | "shape">;

interface WeaponAttackInput {
  readonly attacker: Pick<Entity, "body">;
  readonly direction: { readonly x: number; readonly y: number };
  readonly profile: AttackGeometry;
}

export interface WeaponAttackPointInput extends WeaponAttackInput {
  readonly point: { readonly x: number; readonly y: number; readonly z: number };
  readonly pointRadius: number;
}

export interface WeaponAttackHurtboxInput extends WeaponAttackInput {
  readonly target: Pick<Entity, "body" | "kind" | "combatHurtbox">;
}

/** True when a circular physical volume intersects the canonical live attack area. */
export function weaponAttackContainsPoint(input: WeaponAttackPointInput): boolean {
  if (!withinWeaponHeight(input.attacker.body.z, input.point.z)) return false;
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

/** True when the raw weapon area intersects a target's authoritative AABB. */
export function weaponAttackIntersectsHurtbox(
  input: WeaponAttackHurtboxInput,
): boolean {
  if (!withinWeaponHeight(input.attacker.body.z, input.target.body.z)) return false;
  const bounds = relativeHurtboxBounds(input);
  if (input.profile.shape === "ground") {
    return diskIntersectsBounds(input.profile.range, bounds);
  }
  return sectorIntersectsBounds({
    ...input.profile,
    direction: input.direction,
  }, bounds);
}

function relativeHurtboxBounds(input: WeaponAttackHurtboxInput): Bounds2 {
  const bounds = combatHurtboxBounds(input.target);
  return {
    minX: bounds.minX - input.attacker.body.x,
    maxX: bounds.maxX - input.attacker.body.x,
    minY: bounds.minY - input.attacker.body.y,
    maxY: bounds.maxY - input.attacker.body.y,
  };
}

function withinWeaponHeight(attackerZ: number, targetZ: number): boolean {
  return Math.abs(targetZ - attackerZ) <= 1.5;
}
