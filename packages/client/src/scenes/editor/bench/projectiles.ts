// Bench projectile flight: reuses the engine's ballistic step and holds ranged damage
// until a rendered spit reaches the training dummy instead of resolving it at launch.
import { THROW_SPEED, TICK_DT, createBody, launchVelocity, makeEntity, stepProjectile, type EffectEvent } from "@dc2d/engine";
import type { BenchEnemy, BenchState } from "./state.js";

/** Launches the same engine projectile arc the production spitter uses. */
export function launchBenchSpit(state: BenchState, enemy: BenchEnemy, target: { x: number; y: number; z: number }): void {
  const origin = { x: enemy.entity.body.x, y: enemy.entity.body.y, z: enemy.entity.body.z + 0.5 };
  const entity = makeEntity("projectile", createBody(origin.x, origin.y, origin.z), {
    ownerId: enemy.entity.id,
    tags: new Set(["spit", ...enemy.def.tags]),
    vel: launchVelocity(origin, target, THROW_SPEED),
  });
  state.projectiles.set(entity.id, { entity, attack: enemy.def.attack });
}

/** Advances every visible projectile and resolves its payload only on collision. */
export function stepBenchProjectiles(state: BenchState, events: EffectEvent[]): void {
  for (const [id, projectile] of state.projectiles) {
    const flight = stepProjectile(state.world, projectile.entity, TICK_DT);
    const hitDummy = hitsDummy(state, projectile.entity.body);
    if (!flight.impact && !hitDummy) continue;
    state.projectiles.delete(id);
    if (hitDummy) resolveSpitHit(state, projectile.attack, events);
  }
}

function hitsDummy(state: BenchState, body: { x: number; y: number; z: number }): boolean {
  const dummy = state.dummy;
  return Math.hypot(dummy.body.x - body.x, dummy.body.y - body.y) < 0.7 && Math.abs(dummy.body.z + 0.8 - body.z) < 1.2;
}

function resolveSpitHit(state: BenchState, attack: BenchEnemy["def"]["attack"], events: EffectEvent[]): void {
  if (state.dummy.hp <= 0) return;
  state.effects.modifyHealth(state.dummy, -attack.damage, events, { sourceTags: ["spit"] }, {});
  for (const apply of attack.applies ?? []) {
    if (state.rng.next() < apply.chance) state.effects.applyStatus(state.dummy, apply.status, events, {});
  }
}
