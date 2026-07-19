import { TICK_DT, stepProjectile, type EffectEvent, type Entity, type Primitive } from "@dc2d/engine";
import { combatants, effectTargetFor, spawnItem } from "./helpers.js";
import type { SimState } from "./state.js";

/** Thrown items and enemy spit: flight, direct hits, impact effects. */

export function stepProjectiles(sim: SimState, effectEvents: EffectEvent[]): void {
  for (const [id, projectile] of sim.projectiles) {
    const result = stepProjectile(sim.world, projectile, TICK_DT);
    const directHit = findDirectHit(sim, projectile);
    if (!directHit && !result.impact) continue;

    sim.projectiles.delete(id);
    const point = directHit?.body ?? result.impact ?? projectile.body;
    resolveImpact(sim, projectile, point.x, point.y, directHit, effectEvents);
  }
}

/** First living combatant the projectile is touching mid-flight (never the thrower). */
function findDirectHit(sim: SimState, projectile: Entity): Entity | null {
  for (const candidate of combatants(sim)) {
    if (candidate.id === projectile.ownerId || candidate.hp <= 0) continue;
    const d = Math.hypot(
      candidate.body.x - projectile.body.x,
      candidate.body.y - projectile.body.y,
    );
    if (d < 0.7 && Math.abs(candidate.body.z + 0.8 - projectile.body.z) < 1.2) {
      return candidate;
    }
  }
  return null;
}

function resolveImpact(
  sim: SimState,
  projectile: Entity,
  x: number,
  y: number,
  directHit: Entity | null,
  effectEvents: EffectEvent[],
): void {
  if (!projectile.defId) {
    resolveSpitImpact(sim, projectile, directHit, effectEvents);
    return;
  }
  resolveThrowableImpact(sim, projectile, x, y, effectEvents);
}

/** Enemy spit: plain damage + statuses on whatever it hit. */
function resolveSpitImpact(
  sim: SimState,
  projectile: Entity,
  directHit: Entity | null,
  effectEvents: EffectEvent[],
): void {
  if (!directHit) return;
  const owner = sim.enemies.get(projectile.ownerId ?? "");
  const damage = owner?.def.attack.damage ?? 2;
  const target = effectTargetFor(sim, directHit);
  sim.effects.modifyHealth(directHit, -damage, effectEvents, { sourceTags: ["spit"] }, target);
  for (const apply of owner?.def.attack.applies ?? []) {
    if (sim.rng.next() < apply.chance) {
      sim.effects.applyStatus(directHit, apply.status, effectEvents, target);
    }
  }
}

/** Thrown item: runs its onImpact primitives, then drops or breaks. */
function resolveThrowableImpact(
  sim: SimState,
  projectile: Entity,
  x: number,
  y: number,
  effectEvents: EffectEvent[],
): void {
  const def = sim.content.items.get(projectile.defId ?? "");
  if (!def?.throwable) return;
  const tileX = Math.floor(x);
  const tileY = Math.floor(y);
  for (const primitive of def.throwable.onImpact) {
    if (primitive.primitive === "spawn_area") {
      sim.areas.spawn(primitive.area, tileX, tileY, primitive.radius);
      continue;
    }
    applyPrimitiveInBlastRadius(sim, projectile, primitive, x, y, effectEvents);
  }
  if (sim.rng.next() >= def.throwable.breakChance) {
    spawnItem(sim, projectile.defId ?? "", x, y, 1);
  }
}

/** Runs one entity-targeted onImpact primitive against everything within a tile of (x, y). */
function applyPrimitiveInBlastRadius(
  sim: SimState,
  projectile: Entity,
  primitive: Primitive,
  x: number,
  y: number,
  effectEvents: EffectEvent[],
): void {
  for (const victim of combatants(sim)) {
    if (victim.hp <= 0) continue;
    const d = Math.hypot(victim.body.x - x, victim.body.y - y);
    if (d > 1.2) continue;
    sim.effects.runPrimitives(
      victim,
      [primitive],
      effectEvents,
      effectTargetFor(sim, victim),
      () => sim.rng.next(),
      [...projectile.tags],
    );
  }
}
