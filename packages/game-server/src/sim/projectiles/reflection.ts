import {
  PROJECTILE_CONTACT_RADIUS,
  weaponHitboxContainsPoint,
  type Entity,
  type WeaponProfile,
} from "@dc2d/engine";
import { activeMeleeAttackFor } from "../state/meleeAttackState.js";
import type { SimState } from "../state/state.js";

export interface ProjectileReturnContext {
  readonly sim: SimState;
  readonly attacker: Entity;
  readonly direction: { readonly x: number; readonly y: number };
  readonly profile: WeaponProfile;
}

/** Returns each nearby hostile spit that intersects the accepted weapon hitbox. */
export function returnHostileProjectiles(context: ProjectileReturnContext): void {
  for (const projectile of context.sim.projectiles.values()) {
    tryReturnProjectile(context, projectile);
  }
}

/**
 * Checks the just-moved projectile against every still-active sword volume before
 * projectile contact damage resolves for this tick.
 */
export function returnProjectileDuringActiveMeleeAttack(
  sim: SimState,
  projectile: Entity,
): boolean {
  for (const slot of sim.players.values()) {
    const attack = activeMeleeAttackFor(slot);
    if (!attack) continue;
    if (tryReturnProjectile({
      sim,
      attacker: slot.entity,
      direction: attack.direction,
      profile: attack.profile,
    }, projectile)) return true;
  }
  return false;
}

function tryReturnProjectile(
  context: ProjectileReturnContext,
  projectile: Entity,
): boolean {
  if (!isReturnableSpit(context.sim, projectile)) return false;
  if (!weaponHitboxContainsPoint(attackPointInput(context, projectile))) return false;
  returnProjectile(projectile, context.attacker.id);
  return true;
}

function isReturnableSpit(sim: SimState, projectile: Entity): boolean {
  if (projectile.defId !== undefined || projectile.returnedByPlayerId !== undefined) return false;
  if (projectile.vel === undefined || projectile.ballisticFlight !== undefined) return false;
  if (projectile.directProjectileImpact === undefined) return false;
  return projectile.tags.has("spit") && sim.enemies.has(projectile.ownerId ?? "");
}

function attackPointInput(
  context: ProjectileReturnContext,
  projectile: Entity,
): Parameters<typeof weaponHitboxContainsPoint>[0] {
  return {
    attacker: context.attacker,
    direction: context.direction,
    point: projectile.body,
    pointRadius: PROJECTILE_CONTACT_RADIUS,
    profile: context.profile,
  };
}

function returnProjectile(projectile: Entity, playerId: string): void {
  const velocity = projectile.vel;
  if (!velocity) return;
  velocity.x = reversedVelocity(velocity.x);
  velocity.y = reversedVelocity(velocity.y);
  velocity.z = reversedVelocity(velocity.z);
  projectile.ownerId = playerId;
  projectile.returnedByPlayerId = playerId;
}

function reversedVelocity(value: number): number {
  return value === 0 ? 0 : -value;
}
