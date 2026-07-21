import { CHASM_DEATH_Z, TICK_RATE, createBody } from "@dc2d/engine";
import type { PlayerSlot, SimState } from "./state.js";

/**
 * Spawn-safety (panel round 3b blocker #1, hardened for round 4's
 * drift-in leak): server-authoritative guarantees at and AFTER every
 * fresh-spawn handoff (join.ts addPlayer, players.ts respawnSlot —
 * which also covers dead resumes and cross-floor deathSpawn arrivals):
 *
 *  1. CLEARANCE — no living hostile within SPAWN_CLEARANCE_RADIUS of
 *     the handoff tile. Loiterers are teleported outward to the nearest
 *     valid tile outside EVERY graced player's radius (relocating
 *     hostiles, not shifting the spawn — docs/ASSUMPTIONS.md #360).
 *  2. MAINTENANCE (round 4, Grinder's drift-in evidence) — the radius
 *     stays hostile-free for the WHOLE grace window, not just the
 *     handoff instant: maintainSpawnClearance re-sweeps every tick
 *     right after enemy population/repopulation (sim/index.ts order),
 *     and the enemy movement step clamps wanderers at the boundary
 *     (enemies/ai.ts moveEnemy) — docs/ASSUMPTIONS.md #380.
 *  3. GRACE — for SPAWN_GRACE_TICKS the player takes no damage and no
 *     debuffs (EffectTarget.invulnerable via helpers.ts's
 *     effectTargetFor) and enemies do not target them (enemies/ai.ts
 *     filters them out). Ends early the moment they move or attack
 *     (players.ts / actions/index.ts) so it can't be combat armor.
 *
 * A deliberate non-goal: live reconnect resumes keep their body and get
 * NONE of these — otherwise disconnect/reconnect becomes a free
 * "scatter the mob pack" button (docs/ASSUMPTIONS.md #362).
 */

/** Vetoable (docs/ASSUMPTIONS.md #360): no-hostile radius, in tiles. */
export const SPAWN_CLEARANCE_RADIUS = 6;
/** Vetoable (docs/ASSUMPTIONS.md #361): grace window, in seconds. */
export const SPAWN_GRACE_SECONDS = 2;
export const SPAWN_GRACE_TICKS = SPAWN_GRACE_SECONDS * TICK_RATE;
// Spiral extent for relocation: enough to escape the clearance circle
// from its very center and still find real floor beyond it.
const RELOCATE_SEARCH_RADIUS = SPAWN_CLEARANCE_RADIUS + 10;

/** The whole handoff guarantee: grace armed FIRST (so the sweep sees
 * this player among the graced centers), then clearance around every
 * currently-graced player — a relocation escaping one radius may not
 * land inside another's. */
export function secureSpawnHandoff(sim: SimState, slot: PlayerSlot): void {
  slot.spawnGraceUntilTick = sim.tickCount + SPAWN_GRACE_TICKS;
  enforceSpawnClearance(sim, gracedClearanceCenters(sim));
}

export function isSpawnProtected(slot: PlayerSlot, tick: number): boolean {
  return tick < slot.spawnGraceUntilTick;
}

/** Grace forfeits on meaningful movement or any offensive action. */
export function endSpawnGrace(slot: PlayerSlot): void {
  slot.spawnGraceUntilTick = 0;
}

/** Every living graced player's position — the centers whose clearance
 * radius is protected this tick. */
export function gracedClearanceCenters(sim: SimState): Array<{ x: number; y: number }> {
  const centers: Array<{ x: number; y: number }> = [];
  for (const slot of sim.players.values()) {
    if (slot.entity.hp <= 0 || !isSpawnProtected(slot, sim.tickCount)) continue;
    centers.push({ x: slot.entity.body.x, y: slot.entity.body.y });
  }
  return centers;
}

/** Is (x, y) strictly inside any protected radius? Shared by the sweep
 * below and the enemy movement clamp (enemies/ai.ts moveEnemy). */
export function insideGracedClearance(
  centers: ReadonlyArray<{ x: number; y: number }>,
  x: number,
  y: number,
): boolean {
  for (const c of centers) {
    if (Math.hypot(c.x - x, c.y - y) < SPAWN_CLEARANCE_RADIUS) return true;
  }
  return false;
}

/** Round-4 per-tick maintenance: re-sweep every graced radius. Runs in
 * GameSim.step() AFTER anything that can add or move enemies into place
 * this tick (chunk population, near-spawn repopulation, hazard reseeds)
 * and BEFORE stepEnemies — so a hostile that appeared inside a graced
 * radius is evicted before it can ever think, move, or strike. */
export function maintainSpawnClearance(sim: SimState): void {
  const centers = gracedClearanceCenters(sim);
  if (centers.length > 0) enforceSpawnClearance(sim, centers);
}

/** Teleport every living hostile inside any center's radius to the
 * nearest valid tile outside ALL of them. Fully deterministic: fixed
 * enemy-map iteration order, fixed spiral search order, no rng. */
export function enforceSpawnClearance(
  sim: SimState,
  centers: ReadonlyArray<{ x: number; y: number }>,
): void {
  if (centers.length === 0) return;
  const claimed = new Set<string>();
  for (const [id, enemy] of sim.enemies) {
    const body = enemy.entity.body;
    if (enemy.entity.hp <= 0) continue;
    if (!insideGracedClearance(centers, body.x, body.y)) continue;
    const tile = findRelocationTile(sim, body.x, body.y, centers, claimed);
    if (!tile) {
      // Degenerate world with no valid floor in reach: despawn rather
      // than ever hand control over into an ambush.
      sim.enemies.delete(id);
      continue;
    }
    claimed.add(`${tile.x},${tile.y}`);
    const cx = tile.x + 0.5;
    const cy = tile.y + 0.5;
    enemy.entity.body = createBody(cx, cy, sim.world.groundAt(cx, cy));
  }
}

/** Nearest-to-the-enemy walkable, non-sanctuary, non-chasm tile whose
 * center sits outside every graced radius (spiral search, same ring
 * order as spawn.ts's findWalkableNear). */
function findRelocationTile(
  sim: SimState,
  fromX: number,
  fromY: number,
  centers: ReadonlyArray<{ x: number; y: number }>,
  claimed: ReadonlySet<string>,
): { x: number; y: number } | null {
  const originX = Math.floor(fromX);
  const originY = Math.floor(fromY);
  for (let radius = 1; radius <= RELOCATE_SEARCH_RADIUS; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const tx = originX + dx;
        const ty = originY + dy;
        if (claimed.has(`${tx},${ty}`)) continue;
        if (insideGracedClearance(centers, tx + 0.5, ty + 0.5)) continue;
        if (!sim.world.isWalkable(tx, ty) || sim.world.isSanctuary(tx, ty)) continue;
        if (sim.world.heightAt(tx, ty) <= CHASM_DEATH_Z) continue;
        return { x: tx, y: ty };
      }
    }
  }
  return null;
}
