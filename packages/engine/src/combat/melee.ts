import { MELEE_ARC_COS, MELEE_RANGE } from "../core/constants.js";
import type { Entity } from "../entities/entity.js";

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

function closerCandidate(
  current: TargetCandidate | null,
  entity: Entity,
  distance: number,
): TargetCandidate {
  if (current && current.distance <= distance) return current;
  return { entity, distance };
}

function isEligibleTarget(
  attacker: Entity,
  target: Entity,
  nx: number,
  ny: number,
  range: number,
): number | null {
  if (target.id === attacker.id || target.hp <= 0) return null;
  if (target.kind !== "player" && target.kind !== "enemy") return null;
  const dx = target.body.x - attacker.body.x;
  const dy = target.body.y - attacker.body.y;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return null;
  // Vertical reach: can't slap someone three ledges up.
  if (Math.abs(target.body.z - attacker.body.z) > 1.5) return null;
  if (dist > 0.001) {
    const dot = (dx / dist) * nx + (dy / dist) * ny;
    if (dot < MELEE_ARC_COS) return null;
  }
  return dist;
}

function normalizeDirection(dirX: number, dirY: number): { nx: number; ny: number } {
  const len = Math.hypot(dirX, dirY);
  if (len <= 0) return { nx: 1, ny: 0 };
  return { nx: dirX / len, ny: dirY / len };
}

interface BestTargets {
  hostile: TargetCandidate | null;
  friendly: TargetCandidate | null;
}

function findBestTargets(
  attacker: Entity,
  nx: number,
  ny: number,
  candidates: Iterable<Entity>,
  isPartyMember: (target: Entity) => boolean,
  range: number,
): BestTargets {
  const best: BestTargets = { hostile: null, friendly: null };
  for (const target of candidates) {
    const dist = isEligibleTarget(attacker, target, nx, ny, range);
    if (dist === null) continue;
    if (isPartyMember(target)) {
      best.friendly = closerCandidate(best.friendly, target, dist);
    } else {
      best.hostile = closerCandidate(best.hostile, target, dist);
    }
  }
  return best;
}

export function pickMeleeTarget(
  attacker: Entity,
  dirX: number,
  dirY: number,
  candidates: Iterable<Entity>,
  isPartyMember: (target: Entity) => boolean,
  range = MELEE_RANGE,
): Entity | null {
  const { nx, ny } = normalizeDirection(dirX, dirY);
  const best = findBestTargets(attacker, nx, ny, candidates, isPartyMember, range);
  return best.hostile?.entity ?? best.friendly?.entity ?? null;
}
