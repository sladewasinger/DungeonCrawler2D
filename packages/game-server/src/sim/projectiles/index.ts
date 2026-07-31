import {
  PROJECTILE_CONTACT_RADIUS,
  TICK_DT,
  circleIntersectsHurtbox,
  verticalRangeIntersectsHurtbox,
  stepProjectile,
  type EffectEvent,
  type Entity,
} from "@dc2d/engine";
import { combatants } from "../core/helpers.js";
import type { SimState } from "../state/state.js";
import { blocksAttackDirection } from "../players/directionalBlock.js";
import { notifyBlockFeedback } from "../combat/blockFeedback.js";
import { resolveProjectileImpact } from "./impact.js";

/** Thrown items and enemy spit: flight, direct hits, impact effects. */

export function stepProjectiles(sim: SimState, effectEvents: EffectEvent[]): void {
  for (const [id, projectile] of sim.projectiles) {
    const impact = stepProjectile(sim.world, projectile, TICK_DT).impact;
    const directHit = findDirectHit(sim, projectile);
    resolveProjectileStep({ sim, id, projectile, directHit, impact, effectEvents });
  }
}

interface ProjectileStep {
  sim: SimState;
  id: string;
  projectile: Entity;
  directHit: Entity | null;
  impact: { x: number; y: number } | undefined;
  effectEvents: EffectEvent[];
}

function resolveProjectileStep(step: ProjectileStep): void {
  const { sim, id, projectile, directHit, impact, effectEvents } = step;
  if (!directHit && !impact) return;
  sim.projectiles.delete(id);
  if (directHit && projectileBlockedByTarget(sim, projectile, directHit)) {
    notifyBlockFeedback(sim, directHit, "projectile");
    return;
  }
  const point = directHit?.body ?? impact ?? projectile.body;
  resolveProjectileImpact({ sim, projectile, point, directHit, effectEvents });
}

function projectileSource(
  sim: SimState,
  projectile: Entity,
): { x: number; y: number } {
  const owner = projectileOwner(sim, projectile.ownerId);
  if (owner) return { x: owner.body.x, y: owner.body.y };
  return {
    x: projectile.body.x - projectileVelocity(projectile, "x"),
    y: projectile.body.y - projectileVelocity(projectile, "y"),
  };
}

function projectileOwner(
  sim: SimState,
  ownerId: string | undefined,
): Entity | undefined {
  if (!ownerId) return undefined;
  return sim.enemies.get(ownerId)?.entity ?? sim.players.get(ownerId)?.entity;
}

function projectileVelocity(projectile: Entity, axis: "x" | "y"): number {
  return projectile.vel?.[axis] ?? 0;
}

function projectileBlockedByTarget(
  sim: SimState,
  projectile: Entity,
  target: Entity,
): boolean {
  const targetSlot = target.kind === "player"
    ? sim.players.get(target.id)
    : undefined;
  const source = projectileSource(sim, projectile);
  return projectile.defId === undefined &&
    blocksAttackDirection(targetSlot, source.x, source.y);
}

/** First living combatant the projectile is touching mid-flight (never the thrower). */
function findDirectHit(sim: SimState, projectile: Entity): Entity | null {
  for (const candidate of combatants(sim)) {
    if (isDirectProjectileTarget(candidate, projectile)) return candidate;
  }
  return null;
}

function isDirectProjectileTarget(candidate: Entity, projectile: Entity): boolean {
  if (candidate.id === projectile.ownerId || candidate.hp <= 0) return false;
  if (projectile.returnedByPlayerId !== undefined && candidate.kind !== "enemy") return false;
  return withinProjectileRange(candidate, projectile) && alignedWithProjectile(candidate, projectile);
}

function withinProjectileRange(candidate: Entity, projectile: Entity): boolean {
  return circleIntersectsHurtbox(
    projectile.body,
    PROJECTILE_CONTACT_RADIUS,
    candidate,
  );
}

function alignedWithProjectile(candidate: Entity, projectile: Entity): boolean {
  return verticalRangeIntersectsHurtbox(
    projectile.body.z - PROJECTILE_CONTACT_RADIUS,
    projectile.body.z + PROJECTILE_CONTACT_RADIUS,
    candidate,
  );
}
