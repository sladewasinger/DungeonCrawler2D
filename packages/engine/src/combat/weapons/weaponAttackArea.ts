import type { Entity } from "../../entities/entity.js";
import type { WeaponProfile } from "./weaponProfiles.js";

export interface WeaponAttackPointInput {
  readonly attacker: Pick<Entity, "body">;
  readonly direction: { readonly x: number; readonly y: number };
  readonly point: { readonly x: number; readonly y: number; readonly z: number };
  readonly pointRadius: number;
  readonly profile: WeaponProfile;
}

/** True when a physical point volume intersects this weapon's live attack area. */
export function weaponAttackContainsPoint(input: WeaponAttackPointInput): boolean {
  if (!withinWeaponHeight(input)) return false;
  const offset = pointOffset(input);
  if (offset.distance - input.pointRadius > input.profile.range) return false;
  if (input.profile.shape === "ground" || offset.distance <= input.pointRadius) return true;
  return pointWithinCone(input, offset);
}

function withinWeaponHeight(input: WeaponAttackPointInput): boolean {
  return Math.abs(input.point.z - input.attacker.body.z) <= 1.5;
}

function pointOffset(input: WeaponAttackPointInput): {
  readonly x: number;
  readonly y: number;
  readonly distance: number;
} {
  const x = input.point.x - input.attacker.body.x;
  const y = input.point.y - input.attacker.body.y;
  return { x, y, distance: Math.hypot(x, y) };
}

function pointWithinCone(
  input: WeaponAttackPointInput,
  offset: ReturnType<typeof pointOffset>,
): boolean {
  const direction = normalizedDirection(input.direction);
  const dot = (offset.x / offset.distance) * direction.x +
    (offset.y / offset.distance) * direction.y;
  const offAxis = Math.acos(Math.min(1, Math.max(-1, dot)));
  const allowance = Math.asin(Math.min(1, input.pointRadius / offset.distance));
  return offAxis <= Math.acos(input.profile.arcCos) + allowance;
}

function normalizedDirection(direction: WeaponAttackPointInput["direction"]): {
  readonly x: number;
  readonly y: number;
} {
  const length = Math.hypot(direction.x, direction.y);
  if (length <= 0.001) return { x: 1, y: 0 };
  return { x: direction.x / length, y: direction.y / length };
}
