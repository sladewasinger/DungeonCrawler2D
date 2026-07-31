import type { Entity } from "../../entities/entity.js";
import { reachesHurtbox } from "../geometry/hurtboxes.js";
import { selectConeTargets } from "./coneTargeting.js";
import type { WeaponProfile } from "./weaponProfiles.js";

export {
  weaponHitboxContainsPoint,
  weaponHitboxIntersectsHurtbox,
  type WeaponHitboxHurtboxInput,
  type WeaponHitboxPointInput,
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
    if (isGroundTarget(input.attacker, target, input.profile.range)) targets.push(target);
  }
  return targets;
}

function isGroundTarget(attacker: Entity, target: Entity, range: number): boolean {
  if (target.id === attacker.id || target.hp <= 0) return false;
  if (target.kind !== "player" && target.kind !== "enemy") return false;
  if (Math.abs(target.body.z - attacker.body.z) > 1.5) return false;
  return reachesHurtbox(attacker, target, range);
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
