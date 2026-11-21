/** Owns shared committed-animation test steps and projectile payload assertions. */
import { expect } from "vitest";
import type { EnemySlot, SimState } from "../../../state/state.js";
import { stepEnemies } from "../../index.js";

export function advanceFirstRangedRelease(sim: SimState): void {
  stepEnemies(sim, []);
  for (let tick = 0; tick < 5; tick += 1) stepEnemies(sim, []);
}

export function advancePendingRangedRelease(sim: SimState): void {
  const projectileCount = sim.projectiles.size;
  for (let tick = 0; tick < 40 && sim.projectiles.size === projectileCount; tick += 1) {
    stepEnemies(sim, []);
  }
}

export function advanceRangedRecovery(sim: SimState): void {
  for (let tick = 0; tick < 5; tick += 1) stepEnemies(sim, []);
}

export function advancePostRecoveryThinking(
  sim: SimState,
  enemy: EnemySlot,
  cooldown: number,
): void {
  for (let tick = 0; tick < 20; tick += 1) {
    stepEnemies(sim, []);
    if (enemy.animation.state !== "idle") continue;
    stepEnemies(sim, []);
    if (enemy.brain.attackCooldown < cooldown) return;
  }
}

export function expectRangedPayload(
  sim: SimState,
  enemy: EnemySlot,
  ownerId: string,
): void {
  for (const projectile of sim.projectiles.values()) {
    expect(projectile.ownerId).toBe(ownerId);
    expect(projectile.tags).toEqual(new Set(["spit", ...enemy.def.tags]));
    expect(projectile.directProjectileImpact).toMatchObject({
      damage: enemy.def.attack.damage,
      applies: enemy.def.attack.applies,
    });
  }
}

export function facePlayerTowardEnemy(
  player: { body: { x: number; y: number }; facing?: { x: number; y: number } },
  enemy: { body: { x: number; y: number } },
): void {
  const dx = enemy.body.x - player.body.x;
  const dy = enemy.body.y - player.body.y;
  const length = Math.hypot(dx, dy);
  if (length > 0) player.facing = { x: dx / length, y: dy / length };
}
