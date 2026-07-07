import { MELEE_ARC_COS, MELEE_RANGE } from "../core/constants";
import type { Entity } from "../entities/entity";

/**
 * The melee targeting aid (GAME_DESIGN.md § PvPvE): friendly fire is
 * ALWAYS on — but a swing resolves against the *best* target in its
 * arc, with hostiles preferred over the attacker's party members.
 * Fighting shoulder-to-shoulder won't clip your friend; a swing with
 * no hostile in the arc hits whatever is there, friends included.
 */
export function pickMeleeTarget(
  attacker: Entity,
  dirX: number,
  dirY: number,
  candidates: Iterable<Entity>,
  isPartyMember: (target: Entity) => boolean,
  range = MELEE_RANGE,
): Entity | null {
  const len = Math.hypot(dirX, dirY);
  const nx = len > 0 ? dirX / len : 1;
  const ny = len > 0 ? dirY / len : 0;

  let bestHostile: { e: Entity; d: number } | null = null;
  let bestFriendly: { e: Entity; d: number } | null = null;

  for (const target of candidates) {
    if (target.id === attacker.id || target.hp <= 0) continue;
    if (target.kind !== "player" && target.kind !== "enemy") continue;
    const dx = target.body.x - attacker.body.x;
    const dy = target.body.y - attacker.body.y;
    const dist = Math.hypot(dx, dy);
    if (dist > range) continue;
    // Vertical reach: can't slap someone three ledges up.
    if (Math.abs(target.body.z - attacker.body.z) > 1.5) continue;
    if (dist > 0.001) {
      const dot = (dx / dist) * nx + (dy / dist) * ny;
      if (dot < MELEE_ARC_COS) continue;
    }
    const slot = { e: target, d: dist };
    if (isPartyMember(target)) {
      if (!bestFriendly || dist < bestFriendly.d) bestFriendly = slot;
    } else if (!bestHostile || dist < bestHostile.d) {
      bestHostile = slot;
    }
  }
  return bestHostile?.e ?? bestFriendly?.e ?? null;
}
