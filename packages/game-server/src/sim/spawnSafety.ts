import { CHASM_DEATH_Z, TICK_RATE, createBody } from "@dc2d/engine";
import type { PlayerSlot, SimState } from "./state.js";

/**
 * Spawn-safety (panel round 3b blocker #1): a hostile could occupy or
 * threaten the entry tile at the instant control is handed over, and a
 * death could respawn into the same ambush — pre-input deaths. Two
 * server-authoritative guarantees at every fresh-spawn handoff
 * (join.ts addPlayer, players.ts respawnSlot — which also covers dead
 * resumes and cross-floor deathSpawn arrivals):
 *
 *  1. CLEARANCE — no living hostile within SPAWN_CLEARANCE_RADIUS of
 *     the handoff tile. Loiterers are teleported outward to the nearest
 *     valid tile outside the radius (relocating hostiles, not shifting
 *     the spawn, keeps all three findSpawn modes' deterministic
 *     geometry untouched — see docs/ASSUMPTIONS.md #360).
 *  2. GRACE — for SPAWN_GRACE_TICKS the player takes no damage and no
 *     debuffs (EffectTarget.invulnerable via helpers.ts's
 *     effectTargetFor) and enemies do not target them (enemies/ai.ts
 *     filters them out). Ends early the moment they move or attack
 *     (players.ts / actions/index.ts) so it can't be combat armor.
 *
 * A deliberate non-goal: live reconnect resumes keep their body and get
 * NEITHER guarantee — otherwise disconnect/reconnect becomes a free
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

/** The whole handoff guarantee: clearance around the slot's (already
 * assigned) spawn body, then the grace window. */
export function secureSpawnHandoff(sim: SimState, slot: PlayerSlot): void {
  enforceSpawnClearance(sim, slot.entity.body.x, slot.entity.body.y);
  slot.spawnGraceUntilTick = sim.tickCount + SPAWN_GRACE_TICKS;
}

export function isSpawnProtected(slot: PlayerSlot, tick: number): boolean {
  return tick < slot.spawnGraceUntilTick;
}

/** Grace forfeits on meaningful movement or any offensive action. */
export function endSpawnGrace(slot: PlayerSlot): void {
  slot.spawnGraceUntilTick = 0;
}

/** Teleport every living hostile within SPAWN_CLEARANCE_RADIUS of
 * (x, y) to the nearest valid tile outside it. Fully deterministic:
 * fixed enemy-map iteration order, fixed spiral search order, no rng. */
export function enforceSpawnClearance(sim: SimState, x: number, y: number): void {
  const claimed = new Set<string>();
  for (const [id, enemy] of sim.enemies) {
    const body = enemy.entity.body;
    if (enemy.entity.hp <= 0) continue;
    if (Math.hypot(body.x - x, body.y - y) >= SPAWN_CLEARANCE_RADIUS) continue;
    const tile = findRelocationTile(sim, body.x, body.y, x, y, claimed);
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
 * center sits outside the clearance radius of the spawn (spiral search,
 * same ring order as spawn.ts's findWalkableNear). */
function findRelocationTile(
  sim: SimState,
  fromX: number,
  fromY: number,
  spawnX: number,
  spawnY: number,
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
        if (Math.hypot(tx + 0.5 - spawnX, ty + 0.5 - spawnY) < SPAWN_CLEARANCE_RADIUS) continue;
        if (!sim.world.isWalkable(tx, ty) || sim.world.isSanctuary(tx, ty)) continue;
        if (sim.world.heightAt(tx, ty) <= CHASM_DEATH_Z) continue;
        return { x: tx, y: ty };
      }
    }
  }
  return null;
}
