import { CHASM_DEATH_Z, LEVEL, TICK_RATE } from "@dc2d/engine";
import { spawnEnemy } from "../helpers.js";
import { resolveSpawnAnchor } from "../spawn.js";
import type { SimState } from "../state.js";
import { NEAR_SPAWN_RADIUS_TILES, pickEnemyDef, tooCloseToPlayer } from "./population.js";

/**
 * Periodic near-spawn top-up: `population.ts` seeds each chunk exactly
 * once (`activatedChunks`), so a shared multiplayer floor that gets
 * cleared out near spawn stays empty forever otherwise (GRINDER'S
 * BLOCKER, panel round 2 — "the judges compete for the same spawns").
 * Every REPOPULATE_INTERVAL_TICKS this tops the near-spawn population
 * back up to NEAR_SPAWN_TARGET_COUNT, same placement rules as a fresh
 * spawn (walkable, non-sanctuary, non-chasm, clear of players).
 */

/** ~2 minutes at the fixed tick rate — "refill within a couple minutes" (panel round 2). */
export const REPOPULATE_INTERVAL_TICKS = 2 * 60 * TICK_RATE;
/** Diagnosed baseline was ~5-15 within this radius on a fresh world (docs/ASSUMPTIONS.md
 * #150); target sits above that band so a cleared-out area reliably refills, not just limps. */
const NEAR_SPAWN_TARGET_COUNT = 16;
const REPOPULATE_ATTEMPTS_PER_ENEMY = 20;
const ENEMY_CAP = 150;

/** Tops up near-spawn floor-1 enemy population — no-op off floor 1 or under the target. */
export function repopulateNearSpawn(sim: SimState): void {
  if (sim.world.level === LEVEL.Sandbox || sim.world.floor !== 1) return;
  if (sim.enemies.size >= ENEMY_CAP) return;
  const anchor = resolveSpawnAnchor(sim);
  const deficit = NEAR_SPAWN_TARGET_COUNT - countEnemiesWithin(sim, anchor, NEAR_SPAWN_RADIUS_TILES);
  for (let n = 0; n < deficit; n++) {
    const spot = randomSpotNear(sim, anchor, NEAR_SPAWN_RADIUS_TILES);
    if (spot) spawnEnemy(sim, pickEnemyDef(sim), spot.x + 0.5, spot.y + 0.5);
  }
}

function countEnemiesWithin(sim: SimState, anchor: { x: number; y: number }, radius: number): number {
  let count = 0;
  for (const enemy of sim.enemies.values()) {
    if (Math.hypot(enemy.entity.body.x - anchor.x, enemy.entity.body.y - anchor.y) <= radius) count++;
  }
  return count;
}

/** Random valid placement within `radius` of `anchor` — mirrors spawn.ts's
 * sampleWithinRadius, but this module owns its own placement validity
 * (chasm/sanctuary/player-clearance), same rules population.ts seeds with. */
function randomSpotNear(
  sim: SimState,
  anchor: { x: number; y: number },
  radius: number,
): { x: number; y: number } | null {
  for (let attempt = 0; attempt < REPOPULATE_ATTEMPTS_PER_ENEMY; attempt++) {
    const angle = sim.rng.next() * Math.PI * 2;
    const dist = Math.sqrt(sim.rng.next()) * radius;
    const wx = Math.floor(anchor.x + Math.cos(angle) * dist);
    const wy = Math.floor(anchor.y + Math.sin(angle) * dist);
    if (!sim.world.isWalkable(wx, wy) || sim.world.isSanctuary(wx, wy)) continue;
    if (sim.world.heightAt(wx, wy) <= CHASM_DEATH_Z) continue;
    if (tooCloseToPlayer(sim, wx, wy)) continue;
    return { x: wx, y: wy };
  }
  return null;
}
