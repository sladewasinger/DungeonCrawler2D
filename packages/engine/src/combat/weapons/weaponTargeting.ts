import type { Entity } from "../../entities/entity.js";
import { selectConeTargets } from "./coneTargeting.js";
import { weaponHitboxIntersectsHurtbox } from "./weaponHitbox.js";
import type { WeaponProfile } from "./weaponProfiles.js";

export {
  weaponHitboxContainsPoint,
  weaponHitboxIntersectsHurtbox,
  weaponHitboxVerticalRange,
  type WeaponHitboxHurtboxInput,
  type WeaponHitboxPointInput,
  type WeaponHitboxVerticalRange,
} from "./weaponHitbox.js";

export interface WeaponTargetingInput {
  readonly attacker: Entity;
  readonly direction: { readonly x: number; readonly y: number };
  readonly candidates: Iterable<Entity>;
  readonly isPartyMember: (target: Entity) => boolean;
  readonly profile: WeaponProfile;
}

export function selectWeaponTargets(input: WeaponTargetingInput): Entity[] {
  if (input.profile.shape === "ground") return groundTargets(input);
  return selectConeTargets(input);
}

function groundTargets(input: WeaponTargetingInput): Entity[] {
  const targets: Entity[] = [];
  for (const target of input.candidates) {
    if (isGroundTarget(input, target)) targets.push(target);
  }
  return targets;
}

function isGroundTarget(input: WeaponTargetingInput, target: Entity): boolean {
  if (target.id === input.attacker.id || target.hp <= 0) return false;
  if (target.kind !== "player" && target.kind !== "enemy") return false;
  return weaponHitboxIntersectsHurtbox({
    attacker: input.attacker,
    direction: input.direction,
    profile: input.profile,
    target,
  });
}

export interface AttackKnockback {
  readonly dirX: number;
  readonly dirY: number;
  readonly force: number;
}

export function knockbackForWeapon(
  attacker: Pick<Entity, "body">,
  target: Pick<Entity, "body">,
  profile: WeaponProfile,
): AttackKnockback {
  const dirX = target.body.x - attacker.body.x;
  const dirY = target.body.y - attacker.body.y;
  if (Math.hypot(dirX, dirY) <= 0.001) {
    return { dirX: 1, dirY: 0, force: profile.knockbackForce };
  }
  return { dirX, dirY, force: profile.knockbackForce };
}
