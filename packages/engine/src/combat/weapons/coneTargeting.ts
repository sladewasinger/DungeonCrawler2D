import type { Entity } from "../../entities/entity.js";
import { weaponAttackIntersectsHurtbox } from "./weaponAttackArea.js";
import type { WeaponProfile } from "./weaponProfiles.js";

export interface ConeWeaponTargetingInput {
  readonly attacker: Entity;
  readonly direction: { readonly x: number; readonly y: number };
  readonly candidates: Iterable<Entity>;
  readonly isPartyMember: (target: Entity) => boolean;
  readonly profile: WeaponProfile;
}

/**
 * Cone swings connect with every hostile body. Party targeting aid retains the
 * closest party member only when no hostile body is in the attack area.
 */
export function selectConeTargets(input: ConeWeaponTargetingInput): Entity[] {
  const groups = collectConeTargetGroups(input);
  return groups.hostiles.length > 0
    ? groups.hostiles
    : groups.closestPartyMember ? [groups.closestPartyMember] : [];
}

interface ConeTargetGroups {
  readonly hostiles: Entity[];
  closestPartyMember: Entity | undefined;
  closestPartyDistance: number;
}

function collectConeTargetGroups(input: ConeWeaponTargetingInput): ConeTargetGroups {
  const groups: ConeTargetGroups = {
    hostiles: [],
    closestPartyMember: undefined,
    closestPartyDistance: Infinity,
  };
  for (const target of input.candidates) collectConeTarget(input, groups, target);
  return groups;
}

function collectConeTarget(
  input: ConeWeaponTargetingInput,
  groups: ConeTargetGroups,
  target: Entity,
): void {
  if (!isConeTarget(input, target)) return;
  if (!input.isPartyMember(target)) return void groups.hostiles.push(target);
  collectPartyMember(input.attacker, groups, target);
}

function isConeTarget(input: ConeWeaponTargetingInput, target: Entity): boolean {
  if (!isCombatTarget(input.attacker, target)) return false;
  return weaponAttackIntersectsHurtbox({
    attacker: input.attacker,
    direction: input.direction,
    profile: input.profile,
    target,
  });
}

function isCombatTarget(attacker: Entity, target: Entity): boolean {
  return target.id !== attacker.id && target.hp > 0 &&
    (target.kind === "player" || target.kind === "enemy");
}

function collectPartyMember(
  attacker: Entity,
  groups: ConeTargetGroups,
  target: Entity,
): void {
  const distance = Math.hypot(
    target.body.x - attacker.body.x,
    target.body.y - attacker.body.y,
  );
  if (distance >= groups.closestPartyDistance) return;
  groups.closestPartyMember = target;
  groups.closestPartyDistance = distance;
}
