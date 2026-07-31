import { type EffectEvent, type Entity, type Primitive } from "@dc2d/engine";
import { combatants, damageGivenMultiplierFor, effectTargetFor, spawnItem } from "../core/helpers.js";
import { isOilLob, resolveOilLobImpact } from "../enemies/elemental/oilLob.js";
import type { SimState } from "../state/state.js";
import { resolveSpitImpact } from "./spitImpact.js";

export interface ProjectileImpactContext {
  sim: SimState;
  projectile: Entity;
  point: { x: number; y: number };
  directHit: Entity | null;
  effectEvents: EffectEvent[];
}

/** Resolves either enemy spit or a throwable item's authored impact. */
export function resolveProjectileImpact(context: ProjectileImpactContext): void {
  if (isOilLob(context.projectile)) {
    resolveOilLobImpact(context);
    return;
  }
  if (context.projectile.defId) resolveThrowableImpact(context);
  else resolveSpitImpact(context);
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
    context.sim.areas.spawn({
      defId: primitive.area,
      x: Math.floor(x),
      y: Math.floor(y),
      radius: primitive.radius,
      ...(context.projectile.ownerId === undefined
        ? {}
        : { sourceId: context.projectile.ownerId }),
    });
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
    ...(projectile.ownerId === undefined
      ? {}
      : { sourceId: projectile.ownerId }),
  });
}

function isBlastVictim(point: { x: number; y: number }, victim: Entity): boolean {
  return victim.hp > 0 && Math.hypot(victim.body.x - point.x, victim.body.y - point.y) <= 1.2;
}
