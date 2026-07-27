import { TICK_RATE, createBody } from "@dc2d/engine";
import type { PlayerSlot, SimState } from "../state/state.js";
import { insideGracedClearance } from "./clearance.js";
import { findRelocationTile } from "./relocation.js";

export { SPAWN_CLEARANCE_RADIUS } from "./constants.js";
export { insideGracedClearance } from "./clearance.js";

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

/** Vetoable (docs/ASSUMPTIONS.md #361): grace window, in seconds. */
export const SPAWN_GRACE_SECONDS = 2;
export const SPAWN_GRACE_TICKS = SPAWN_GRACE_SECONDS * TICK_RATE;

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
    relocateHostile({ sim, id, enemy, centers, claimed });
  }
}

interface RelocationRequest {
  sim: SimState;
  id: string;
  enemy: SimState["enemies"] extends Map<string, infer T> ? T : never;
  centers: ReadonlyArray<{ x: number; y: number }>;
  claimed: Set<string>;
}

function relocateHostile({ sim, id, enemy, centers, claimed }: RelocationRequest): void {
  const body = enemy.entity.body;
  if (enemy.entity.hp <= 0 || !insideGracedClearance(centers, body.x, body.y)) return;
  const tile = findRelocationTile({ sim, from: body, centers, claimed });
  if (!tile) {
    sim.enemies.delete(id);
    return;
  }
  claimed.add(`${tile.x},${tile.y}`);
  moveHostileToTile(sim, enemy, tile);
}

function moveHostileToTile(
  sim: SimState,
  enemy: RelocationRequest["enemy"],
  tile: { x: number; y: number },
): void {
  const x = tile.x + 0.5;
  const y = tile.y + 0.5;
  enemy.entity.body = createBody(x, y, sim.world.groundAt(x, y));
}
