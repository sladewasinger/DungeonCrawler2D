import { type EffectEvent, type Entity, type Primitive } from "@dc2d/engine";
import { combatants, damageGivenMultiplierFor, effectTargetFor, spawnItem } from "../core/helpers.js";
import type { SimState } from "../state/state.js";

export interface ProjectileImpactContext {
  sim: SimState;
  projectile: Entity;
  point: { x: number; y: number };
  directHit: Entity | null;
  effectEvents: EffectEvent[];
}

/** Resolves either enemy spit or a throwable item's authored impact. */
export function resolveProjectileImpact(context: ProjectileImpactContext): void {
  if (context.projectile.defId) resolveThrowableImpact(context);
  else resolveSpitImpact(context);
}

function resolveSpitImpact(context: ProjectileImpactContext): void {
  const { sim, projectile, directHit, effectEvents } = context;
  if (!directHit) return;
  const owner = sim.enemies.get(projectile.ownerId ?? "");
  const target = effectTargetFor(sim, directHit);
  applySpitDamage({ sim, directHit, effectEvents, target, damage: owner?.def.attack.damage ?? 2 });
  applySpitStatuses({ sim, directHit, effectEvents, target, applies: owner?.def.attack.applies ?? [] });
}

function applySpitDamage({ sim, directHit, effectEvents, target, damage }: {
  sim: SimState;
  directHit: Entity;
  effectEvents: EffectEvent[];
  target: ReturnType<typeof effectTargetFor>;
  damage: number;
}): void {
  sim.effects.modifyHealth({ entity: directHit, amount: -damage, events: effectEvents, opts: { sourceTags: ["spit"] }, target });
}

function applySpitStatuses({ sim, directHit, effectEvents, target, applies }: {
  sim: SimState;
  directHit: Entity;
  effectEvents: EffectEvent[];
  target: ReturnType<typeof effectTargetFor>;
  applies: Array<{ status: string; chance: number }>;
}): void {
  for (const apply of applies) {
    if (sim.rng.next() >= apply.chance) continue;
    sim.effects.applyStatus({ entity: directHit, statusId: apply.status, events: effectEvents, target });
  }
}

function resolveThrowableImpact(context: ProjectileImpactContext): void {
  const { sim, projectile, point } = context;
  const throwable = sim.content.items.get(projectile.defId ?? "")?.throwable;
  if (!throwable) return;
  applyThrowablePrimitives(context, throwable.onImpact);
  if (sim.rng.next() >= throwable.breakChance) {
    spawnItem(sim, { defId: projectile.defId ?? "", x: point.x, y: point.y, qty: 1 });
  }
}

function applyThrowablePrimitives(context: ProjectileImpactContext, primitives: Primitive[]): void {
  for (const primitive of primitives) applyThrowablePrimitive(context, primitive);
}

function applyThrowablePrimitive(context: ProjectileImpactContext, primitive: Primitive): void {
  if (primitive.primitive === "spawn_area") {
    const { x, y } = context.point;
    context.sim.areas.spawn({ defId: primitive.area, x: Math.floor(x), y: Math.floor(y), radius: primitive.radius });
    return;
  }
  applyPrimitiveInBlastRadius({ ...context, primitive: scaleThrowableDamage(context, primitive) });
}

function scaleThrowableDamage({ sim, projectile }: ProjectileImpactContext, primitive: Primitive): Primitive {
  if (primitive.primitive !== "modify_health" || primitive.amount >= 0) return primitive;
  const owner = projectileOwner(sim, projectile.ownerId);
  const multiplier = owner ? damageGivenMultiplierFor(sim, owner) : 1;
  return multiplier === 1 ? primitive : { ...primitive, amount: primitive.amount * multiplier };
}

function projectileOwner(sim: SimState, ownerId: string | undefined): Entity | undefined {
  if (!ownerId) return undefined;
  return sim.enemies.get(ownerId)?.entity ?? sim.players.get(ownerId)?.entity;
}

interface BlastPrimitiveContext extends ProjectileImpactContext {
  primitive: Primitive;
}

function applyPrimitiveInBlastRadius(context: BlastPrimitiveContext): void {
  for (const victim of combatants(context.sim)) applyBlastPrimitiveToVictim(context, victim);
}

function applyBlastPrimitiveToVictim(context: BlastPrimitiveContext, victim: Entity): void {
  if (!isBlastVictim(context.point, victim)) return;
  const { sim, projectile, primitive, effectEvents } = context;
  sim.effects.runPrimitives({
    entity: victim,
    primitives: [primitive],
    events: effectEvents,
    target: effectTargetFor(sim, victim),
    rng: () => sim.rng.next(),
    sourceTags: [...projectile.tags],
  });
}

function isBlastVictim(point: { x: number; y: number }, victim: Entity): boolean {
  return victim.hp > 0 && Math.hypot(victim.body.x - point.x, victim.body.y - point.y) <= 1.2;
}
