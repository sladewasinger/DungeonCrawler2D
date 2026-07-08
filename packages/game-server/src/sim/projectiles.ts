import { TICK_DT, stepProjectile, type EffectEvent, type Entity } from "@dc2d/engine";
import { combatants, effectTargetFor, spawnItem } from "./helpers";
import type { SimState } from "./state";

/** Thrown items and enemy spit: flight, direct hits, impact effects. */

export function stepProjectiles(sim: SimState, effectEvents: EffectEvent[]): void {
  for (const [id, projectile] of sim.projectiles) {
    const result = stepProjectile(sim.world, projectile, TICK_DT);

    // Direct hits mid-flight (skip the thrower).
    let directHit: Entity | null = null;
    for (const candidate of combatants(sim)) {
      if (candidate.id === projectile.ownerId || candidate.hp <= 0) continue;
      const d = Math.hypot(
        candidate.body.x - projectile.body.x,
        candidate.body.y - projectile.body.y,
      );
      if (d < 0.7 && Math.abs(candidate.body.z + 0.8 - projectile.body.z) < 1.2) {
        directHit = candidate;
        break;
      }
    }

    if (directHit || result.impact) {
      sim.projectiles.delete(id);
      const x = directHit?.body.x ?? result.impact!.x;
      const y = directHit?.body.y ?? result.impact!.y;
      resolveImpact(sim, projectile, x, y, directHit, effectEvents);
    }
  }
}

function resolveImpact(
  sim: SimState,
  projectile: Entity,
  x: number,
  y: number,
  directHit: Entity | null,
  effectEvents: EffectEvent[],
): void {
  // Enemy spit: plain damage + statuses.
  if (!projectile.defId) {
    if (directHit) {
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
    return;
  }

  const def = sim.content.items.get(projectile.defId);
  if (!def?.throwable) return;
  const tileX = Math.floor(x);
  const tileY = Math.floor(y);
  for (const primitive of def.throwable.onImpact) {
    if (primitive.primitive === "spawn_area") {
      sim.areas.spawn(primitive.area, tileX, tileY, primitive.radius);
      continue;
    }
    // Entity-targeted primitives hit everything within a tile.
    for (const victim of combatants(sim)) {
      if (victim.hp <= 0) continue;
      const d = Math.hypot(victim.body.x - x, victim.body.y - y);
      if (d <= 1.2) {
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
  }
  if (sim.rng.next() >= def.throwable.breakChance) {
    spawnItem(sim, projectile.defId, x, y, 1);
  }
}
