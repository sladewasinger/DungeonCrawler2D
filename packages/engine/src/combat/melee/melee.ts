import { MELEE_ARC_COS, MELEE_RANGE } from "../../core/constants.js";
import type { Entity } from "../../entities/entity.js";
import { combatHurtboxRadius } from "../geometry/hurtboxes.js";

/**
 * The melee targeting aid (GAME_DESIGN.md § PvPvE): friendly fire is
 * ALWAYS on — but a swing resolves against the *best* target in its
 * arc, with hostiles preferred over the attacker's party members.
 * Fighting shoulder-to-shoulder won't clip your friend; a swing with
 * no hostile in the arc hits whatever is there, friends included.
 */

interface TargetCandidate {
  entity: Entity;
  distance: number;
}

interface Direction {
  x: number;
  y: number;
}

interface TargetEligibility {
  attacker: Entity;
  target: Entity;
  direction: Direction;
  range: number;
  halfArcRad: number;
}

interface TargetSearch {
  attacker: Entity;
  direction: Direction;
  candidates: Iterable<Entity>;
  isPartyMember: (target: Entity) => boolean;
  range: number;
  halfArcRad: number;
}

export interface MeleeTargetInput {
  attacker: Entity;
  direction: Direction;
  candidates: Iterable<Entity>;
  isPartyMember: (target: Entity) => boolean;
  range?: number;
  arcCos?: number;
}

export interface FacingArcInput {
  facing: Direction;
  target: Direction;
  arcCos?: number;
}

function closerCandidate(
  current: TargetCandidate | null,
  entity: Entity,
  distance: number,
): TargetCandidate {
  if (current && current.distance <= distance) return current;
  return { entity, distance };
}

function isEligibleTarget({ attacker, target, direction, range, halfArcRad }: TargetEligibility): number | null {
  if (!isCombatTarget(attacker, target)) return null;
  const dx = target.body.x - attacker.body.x;
  const dy = target.body.y - attacker.body.y;
  const dist = Math.hypot(dx, dy);
  if (!isWithinMeleeRange({ attacker, target, distance: dist, range })) return null;
  if (!isWithinMeleeArc({ dx, dy, distance: dist, direction, halfArcRad, target })) return null;
  return dist;
}

function isCombatTarget(attacker: Entity, target: Entity): boolean {
  return target.id !== attacker.id && target.hp > 0 && (target.kind === "player" || target.kind === "enemy");
}

function isWithinMeleeRange({ attacker, target, distance, range }: { attacker: Entity; target: Entity; distance: number; range: number }): boolean {
  return distance - combatHurtboxRadius(target) <= range && Math.abs(target.body.z - attacker.body.z) <= 1.5;
}

function isWithinMeleeArc({ dx, dy, distance, direction, halfArcRad, target }: {
  dx: number;
  dy: number;
  distance: number;
  direction: Direction;
  halfArcRad: number;
  target: Entity;
}): boolean {
  if (distance <= 0.001) return true;
  const dot = (dx / distance) * direction.x + (dy / distance) * direction.y;
  const offAxisRad = Math.acos(Math.min(1, Math.max(-1, dot)));
  const bodyAllowanceRad = Math.asin(Math.min(1, combatHurtboxRadius(target) / distance));
  return offAxisRad <= halfArcRad + bodyAllowanceRad;
}

function normalizeDirection({ x, y }: Direction): Direction {
  const len = Math.hypot(x, y);
  if (len <= 0) return { x: 1, y: 0 };
  return { x: x / len, y: y / len };
}

export function isWithinFacingArc({ facing, target, arcCos = MELEE_ARC_COS }: FacingArcInput): boolean {
  const normalizedFacing = normalizeDirection(facing);
  const targetLength = Math.hypot(target.x, target.y);
  if (targetLength <= 0.001) return true;
  return normalizedFacing.x * (target.x / targetLength) +
      normalizedFacing.y * (target.y / targetLength) >= arcCos;
}

interface BestTargets {
  hostile: TargetCandidate | null;
  friendly: TargetCandidate | null;
}

function findBestTargets({ attacker, direction, candidates, isPartyMember, range, halfArcRad }: TargetSearch): BestTargets {
  const best: BestTargets = { hostile: null, friendly: null };
  for (const target of candidates) {
    const dist = isEligibleTarget({ attacker, target, direction, range, halfArcRad });
    if (dist !== null) updateBestTarget({ best, target, distance: dist, isPartyMember });
  }
  return best;
}

function updateBestTarget({ best, target, distance, isPartyMember }: {
  best: BestTargets;
  target: Entity;
  distance: number;
  isPartyMember: (target: Entity) => boolean;
}): void {
  if (isPartyMember(target)) best.friendly = closerCandidate(best.friendly, target, distance);
  else best.hostile = closerCandidate(best.hostile, target, distance);
}

export function pickMeleeTarget({ attacker, direction, candidates, isPartyMember, range = MELEE_RANGE, arcCos = MELEE_ARC_COS }: MeleeTargetInput): Entity | null {
  const normalizedDirection = normalizeDirection(direction);
  const best = findBestTargets({ attacker, direction: normalizedDirection, candidates, isPartyMember, range, halfArcRad: Math.acos(arcCos) });
  return best.hostile?.entity ?? best.friendly?.entity ?? null;
}
