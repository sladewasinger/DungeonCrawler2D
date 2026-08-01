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
import { returnProjectileDuringActiveMeleeAttack } from "./reflection.js";
import { resolveBlockedOilLobImpact } from "./blockedImpact.js";
import { isOilLob } from "../enemies/elemental/oilLob.js";

export function stepProjectiles(sim: SimState, effectEvents: EffectEvent[]): void {
  for (const [id, projectile] of sim.projectiles) {
    const impact = stepProjectile(sim.world, projectile, TICK_DT).impact;
    const returned = returnProjectileDuringActiveMeleeAttack(sim, projectile);
    const directHit = findDirectHit(sim, projectile);
    resolveProjectileStep({
      sim,
      id,
      projectile,
      directHit,
      impact: returned ? undefined : impact,
      effectEvents,
    });
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
    resolveBlockedOilLobImpact({
      sim,
      projectile,
      directHit,
      effectEvents,
    });
    return;
  }
  const point = directHit?.body ?? impact ?? projectile.body;
  resolveProjectileImpact({ sim, projectile, point, directHit, effectEvents });
}

function projectileSource(
  sim: SimState,
  projectile: Entity,
): { x: number; y: number } {
  const incomingSource = projectileIncomingSource(projectile);
  if (incomingSource) return incomingSource;
  const owner = projectileOwner(sim, projectile.ownerId);
  if (owner) return { x: owner.body.x, y: owner.body.y };
  return {
    x: projectile.body.x - projectileVelocity(projectile, "x"),
    y: projectile.body.y - projectileVelocity(projectile, "y"),
  };
}

function projectileIncomingSource(
  projectile: Entity,
): { x: number; y: number } | undefined {
  const velocity = projectile.vel;
  if (!velocity || Math.hypot(velocity.x, velocity.y) <= 0.001) return undefined;
  return {
    x: projectile.body.x - velocity.x,
    y: projectile.body.y - velocity.y,
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
  return isBlockableProjectile(projectile) &&
    blocksAttackDirection(targetSlot, source.x, source.y);
}

function isBlockableProjectile(projectile: Entity): boolean {
  return projectile.defId === undefined || isOilLob(projectile);
}

function findDirectHit(sim: SimState, projectile: Entity): Entity | null {
  for (const candidate of combatants(sim)) {
    if (isDirectProjectileTarget(sim, candidate, projectile)) return candidate;
  }
  return null;
}

function isDirectProjectileTarget(
  sim: SimState,
  candidate: Entity,
  projectile: Entity,
): boolean {
  if (candidate.id === projectile.ownerId || candidate.hp <= 0) return false;
  if (!isHostileProjectileTarget(sim, candidate, projectile)) return false;
  return withinProjectileRange(candidate, projectile) && alignedWithProjectile(candidate, projectile);
}

function isHostileProjectileTarget(
  sim: SimState,
  candidate: Entity,
  projectile: Entity,
): boolean {
  if (projectile.returnedByPlayerId !== undefined) return candidate.kind === "enemy";
  const owner = projectileOwnerKind(sim, projectile);
  return owner === "enemy"
    ? candidate.kind === "player"
    : owner === "player"
      ? candidate.kind === "enemy"
      : true;
}

function projectileOwnerKind(
  sim: SimState,
  projectile: Entity,
): Entity["kind"] | undefined {
  return projectileOwner(sim, projectile.ownerId)?.kind;
}

function withinProjectileRange(candidate: Entity, projectile: Entity): boolean {
  return circleIntersectsHurtbox(projectile.body, PROJECTILE_CONTACT_RADIUS, candidate);
}

function alignedWithProjectile(candidate: Entity, projectile: Entity): boolean {
  return verticalRangeIntersectsHurtbox(
    projectile.body.z - PROJECTILE_CONTACT_RADIUS,
    projectile.body.z + PROJECTILE_CONTACT_RADIUS,
    candidate);
}
