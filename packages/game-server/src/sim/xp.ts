import { MELEE_RANGE, XP_LEVEL_CURVE_COEFFICIENT, xpForLevel } from "@dc2d/engine";
import type { EnemySlot, PlayerSlot, SimState } from "./state.js";

/**
 * Kill-XP awarding: attributes an enemy death to its killer, grants XP off
 * the enemy's content def, and persists the resulting level via
 * PlayerStore — Epic 11 core, pulled forward into Epic 7.13 (ASSUMPTION
 * #86, docs/ASSUMPTIONS.md).
 */

/**
 * Inverts `xpForLevel` (closed-form quadratic solve, then a bounded
 * correction for float error) — highest level whose cumulative
 * requirement `xp` meets or exceeds. No cap, so this must stay O(1)
 * rather than counting up from level 1.
 */
export function levelForXp(xp: number): number {
  if (xp <= 0) return 1;
  const raw = (1 + Math.sqrt(1 + (4 * xp) / XP_LEVEL_CURVE_COEFFICIENT)) / 2;
  let level = Math.max(1, Math.floor(raw + 1e-9));
  while (xpForLevel(level + 1) <= xp) level++;
  while (level > 1 && xpForLevel(level) > xp) level--;
  return level;
}

/**
 * Last-hitter attribution (ASSUMPTION #90): melee is currently the only
 * path a player deals direct damage to an enemy (thrown items only spawn
 * area effects — see packages/content/src/data/items.json's `onImpact`),
 * and `resolveDeaths` runs in the same tick as the swing that killed it.
 * So "whichever player's swing landed this exact tick, nearest the
 * corpse, within melee range" is a reliable killer without needing an
 * attacker-id field threaded through the combat resolvers (out of this
 * lane's owned files). Ties go to the nearer attacker; a kill with no
 * qualifying attacker this tick (DOT/environmental) awards nobody.
 */
function findKiller(sim: SimState, enemy: EnemySlot): PlayerSlot | null {
  let best: PlayerSlot | null = null;
  let bestDist = Infinity;
  for (const slot of sim.players.values()) {
    if (slot.attackStartedAtTick !== sim.tickCount) continue;
    const dx = slot.entity.body.x - enemy.entity.body.x;
    const dy = slot.entity.body.y - enemy.entity.body.y;
    const dist = Math.hypot(dx, dy);
    if (dist > MELEE_RANGE || dist >= bestDist) continue;
    best = slot;
    bestDist = dist;
  }
  return best;
}

/**
 * Award hook, called from deaths.ts's enemy-death loop. Awards nothing for
 * enemies without a content `xp` value and nothing when no killer can be
 * attributed this tick. On a level-up, emits an interim system chat line
 * ("Level 7!") so progress reads before any client HUD exists.
 */
export function awardKillXp(sim: SimState, enemy: EnemySlot): void {
  const amount = enemy.def.xp ?? 0;
  if (amount <= 0) return;
  const killer = findKiller(sim, enemy);
  if (!killer) return;
  const { level, leveledUp } = sim.store.addXp(killer.stored, amount, levelForXp);
  if (!leveledUp) return;
  killer.outbox.push({
    t: "chat",
    channel: "system",
    from: "server",
    name: "system",
    text: `Level ${level}!`,
  });
}
