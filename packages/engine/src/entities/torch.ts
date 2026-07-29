import type { WorldView } from "../world/core/types.js";
import type { Entity } from "./entity.js";
import {
  createBallisticFlight,
  resolveBallisticThrow,
  stepProjectile,
  type BallisticFlight,
} from "./projectile.js";

/**
 * Thrown-torch flight and landing: an ordinary projectile arc (see
 * projectile.ts), aimed at the same clamped destination as every other
 * throwable. On impact it keeps the accepted projectile position and becomes
 * a placed light source instead of disappearing like a normal projectile.
 */

export interface TorchLaunch {
  vel: { x: number; y: number; z: number };
  ballisticFlight: BallisticFlight;
}

/** Computes torch flight through the shared target-based ballistic contract. */
export function launchTorch({ world, from, target }: {
  world: WorldView;
  from: { x: number; y: number; z: number };
  target: { x: number; y: number };
}): TorchLaunch {
  const ballistic = resolveBallisticThrow({ world, from, target });
  return {
    vel: ballistic.vel,
    ballisticFlight: createBallisticFlight(from, ballistic),
  };
}

export interface TorchStepResult {
  /** True the tick a flying torch lands and becomes placed. */
  landed?: boolean;
}

/**
 * Steps a flying torch's arc one tick. No-op once placed (a placed torch
 * has no velocity to integrate — its lifetime is a tick countdown owned
 * by the caller). On impact — ground or a wall, per stepProjectile's
 * visual-height blocking rule — preserves the accepted impact point and
 * flips torchState to "placed".
 */
export function stepTorch(world: WorldView, torch: Entity, dt: number): TorchStepResult {
  if (torch.torchState !== "flying") return {};
  const result = stepProjectile(world, torch, dt);
  if (!result.impact) return {};
  torch.body.x = result.impact.x;
  torch.body.y = result.impact.y;
  torch.body.z = world.groundAt(result.impact.x, result.impact.y);
  torch.body.grounded = true;
  delete torch.vel;
  delete torch.ballisticFlight;
  torch.torchState = "placed";
  return { landed: true };
}
