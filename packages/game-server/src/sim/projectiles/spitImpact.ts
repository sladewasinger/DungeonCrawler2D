import {
  type DirectProjectileImpact,
  type EffectEvent,
  type Entity,
} from "@dc2d/engine";
import { effectTargetFor } from "../core/helpers.js";
import type { SimState } from "../state/state.js";

export interface SpitImpactContext {
  readonly sim: SimState;
  readonly projectile: Entity;
  readonly directHit: Entity | null;
  readonly effectEvents: EffectEvent[];
}

interface SpitEffectContext {
  readonly sim: SimState;
  readonly directHit: Entity;
  readonly effectEvents: EffectEvent[];
  readonly target: ReturnType<typeof effectTargetFor>;
  readonly sourceId: string | undefined;
}

interface SpitDamageContext extends SpitEffectContext {
  readonly damage: number;
}

interface SpitStatusContext extends SpitEffectContext {
  readonly applies: readonly { readonly status: string; readonly chance: number }[];
}

export function resolveSpitImpact(context: SpitImpactContext): void {
  const { sim, projectile, directHit, effectEvents } = context;
  if (!directHit) return;
  const impact = spitImpact(sim, projectile);
  const target = effectTargetFor(sim, directHit);
  applySpitDamage({
    sim,
    directHit,
    effectEvents,
    target,
    damage: impact.damage,
    sourceId: projectile.ownerId,
  });
  applySpitStatuses({
    sim,
    directHit,
    effectEvents,
    target,
    applies: impact.applies,
    sourceId: projectile.ownerId,
  });
}

function spitImpact(sim: SimState, projectile: Entity): DirectProjectileImpact {
  if (projectile.directProjectileImpact) return projectile.directProjectileImpact;
  const attack = sim.enemies.get(projectile.ownerId ?? "")?.def.attack;
  return { damage: attack?.damage ?? 2, applies: attack?.applies ?? [] };
}

function applySpitDamage(context: SpitDamageContext): void {
  const { sim, directHit, effectEvents, target, damage, sourceId } = context;
  sim.effects.modifyHealth({
    entity: directHit,
    amount: -damage,
    events: effectEvents,
    opts: { sourceTags: ["spit"], ...(sourceId === undefined ? {} : { sourceId }) },
    target,
  });
}

function applySpitStatuses(context: SpitStatusContext): void {
  const { sim, directHit, effectEvents, target, applies, sourceId } = context;
  for (const apply of applies) {
    if (sim.rng.next() >= apply.chance) continue;
    sim.effects.applyStatus({
      entity: directHit,
      statusId: apply.status,
      events: effectEvents,
      target,
      ...(sourceId === undefined ? {} : { sourceId }),
    });
  }
}
