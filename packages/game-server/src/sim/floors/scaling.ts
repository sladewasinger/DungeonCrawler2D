import type { EnemyDef } from "@dc2d/engine";
import { FLOOR_STAT_GROWTH } from "./constants.js";

/**
 * Per-floor enemy stat scaling (Epic 7.14): the ONE place hp/damage/xp
 * multipliers are computed, applied once at enemy spawn (helpers.ts's
 * spawnEnemy) — never at content-load or in combat resolution, and never
 * touching speed, tags, or anything visual.
 */

/** floor 1 => 1.0 exactly (FLOOR_STAT_GROWTH^0); +35% compounding per floor after. */
export function floorStatMultiplier(floor: number): number {
  return FLOOR_STAT_GROWTH ** Math.max(0, floor - 1);
}

/**
 * A per-instance clone of `def` with hp/attack.damage/xp scaled for
 * `floor`. Content EnemyDef objects are shared (one per species, reused
 * by every spawn across every floor) — mutating one in place would
 * corrupt every other enemy of that species on every other floor, so
 * scaling always produces a fresh object rather than touching `def`.
 * Floor 1 returns the same `def` reference unchanged (zero behavior
 * change there, and zero extra allocation).
 */
export function scaledEnemyDef(def: EnemyDef, floor: number): EnemyDef {
  const mult = floorStatMultiplier(floor);
  if (mult === 1) return def;
  return {
    ...def,
    hp: def.hp * mult,
    attack: { ...def.attack, damage: def.attack.damage * mult },
    ...(def.xp !== undefined ? { xp: Math.round(def.xp * mult) } : {}),
  };
}
