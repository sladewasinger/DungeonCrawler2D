import { GRAVITY } from "../core/constants.js";
import type { WorldView } from "../world/types.js";
import type { Entity } from "./entity.js";

/**
 * Thrown-item / spit ballistics: simple arcs integrated on the server
 * tick. Observers render the same arc from position snapshots.
 */

export interface ProjectileStep {
  /** Reached ground or a wall — resolve the impact. */
  impact?: { x: number; y: number };
}

/** Velocity that arcs from `from` (at z0) to land at `to` in dist/speed seconds. */
export function launchVelocity(
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  speed: number,
): { x: number; y: number; z: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.max(0.001, Math.hypot(dx, dy));
  const t = dist / speed;
  const vz = (to.z - from.z + (GRAVITY / 2) * t * t) / t;
  return { x: dx / t, y: dy / t, z: vz };
}

export function stepProjectile(world: WorldView, p: Entity, dt: number): ProjectileStep {
  const vel = p.vel;
  if (!vel) return { impact: { x: p.body.x, y: p.body.y } };

  const nx = p.body.x + vel.x * dt;
  const ny = p.body.y + vel.y * dt;
  const tileX = Math.floor(nx);
  const tileY = Math.floor(ny);

  // Walls stop flight (impact at the current tile, not inside the wall).
  if (!world.isWalkable(tileX, tileY)) {
    return { impact: { x: p.body.x, y: p.body.y } };
  }
  p.body.x = nx;
  p.body.y = ny;

  p.body.z += vel.z * dt;
  vel.z -= GRAVITY * dt;
  const terrain = world.groundAt(nx, ny);
  if (p.body.z <= terrain) {
    p.body.z = terrain;
    return { impact: { x: nx, y: ny } };
  }
  return {};
}
