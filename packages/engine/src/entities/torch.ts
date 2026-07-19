import { MAX_THROW_RANGE, THROW_SPEED } from "../core/constants.js";
import type { WorldView } from "../world/types.js";
import type { Entity } from "./entity.js";
import { launchVelocity, stepProjectile } from "./projectile.js";

/**
 * Thrown-torch flight and landing: an ordinary projectile arc (see
 * projectile.ts), aimed by direction instead of a clicked tile. On
 * impact it snaps to its landing tile's center and becomes a placed
 * light source instead of resolving throwable impact effects.
 */

export interface TorchLaunch {
  vel: { x: number; y: number; z: number };
}

/**
 * Normalizes a client-supplied aim vector and computes the ballistic
 * launch velocity toward a point MAX_THROW_RANGE away in that direction,
 * reusing the same physics `launchVelocity` uses for target-tile throws.
 * A zero-length vector defaults to straight "north" rather than throwing
 * nowhere.
 */
export function launchTorch(
  world: WorldView,
  from: { x: number; y: number; z: number },
  dirX: number,
  dirY: number,
): TorchLaunch {
  const length = Math.hypot(dirX, dirY);
  const nx = length > 0 ? dirX / length : 0;
  const ny = length > 0 ? dirY / length : -1;
  const targetX = from.x + nx * MAX_THROW_RANGE;
  const targetY = from.y + ny * MAX_THROW_RANGE;
  const to = { x: targetX, y: targetY, z: world.groundAt(targetX, targetY) };
  return { vel: launchVelocity(from, to, THROW_SPEED) };
}

export interface TorchStepResult {
  /** True the tick a flying torch lands and becomes placed. */
  landed?: boolean;
}

/**
 * Steps a flying torch's arc one tick. No-op once placed (a placed torch
 * has no velocity to integrate — its lifetime is a tick countdown owned
 * by the caller). On impact — ground or a wall, per stepProjectile's
 * visual-height blocking rule — snaps to the landing tile's center and
 * flips torchState to "placed".
 */
export function stepTorch(world: WorldView, torch: Entity, dt: number): TorchStepResult {
  if (torch.torchState !== "flying") return {};
  const result = stepProjectile(world, torch, dt);
  if (!result.impact) return {};
  torch.body.x = Math.floor(result.impact.x) + 0.5;
  torch.body.y = Math.floor(result.impact.y) + 0.5;
  torch.body.z = world.groundAt(torch.body.x, torch.body.y);
  torch.body.grounded = true;
  delete torch.vel;
  torch.torchState = "placed";
  return { landed: true };
}
