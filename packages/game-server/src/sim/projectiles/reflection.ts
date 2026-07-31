import {
  PROJECTILE_CONTACT_RADIUS,
  weaponHitboxContainsPoint,
  type Entity,
  type WeaponProfile,
} from "@dc2d/engine";
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
    if (!isReturnableSpit(context.sim, projectile)) continue;
    if (!weaponHitboxContainsPoint(attackPointInput(context, projectile))) continue;
    returnProjectile(projectile, context.attacker.id);
  }
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
) {
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
