import type { EffectEvent, Entity } from "@dc2d/engine";
import { resolveProjectileImpact } from "./impact.js";
import type { SimState } from "../state/state.js";
import { isOilLob } from "../enemies/elemental/oilLob.js";

interface BlockedProjectileImpact {
  readonly sim: SimState;
  readonly projectile: Entity;
  readonly directHit: Entity | null;
  readonly effectEvents: EffectEvent[];
}

export function resolveBlockedOilLobImpact(input: BlockedProjectileImpact): void {
  if (!isOilLob(input.projectile) || !input.directHit) return;
  resolveProjectileImpact({
    sim: input.sim,
    projectile: input.projectile,
    point: shieldFrontImpactPoint(input.directHit),
    directHit: null,
    effectEvents: input.effectEvents,
  });
}

function shieldFrontImpactPoint(blockingEntity: Entity): { x: number; y: number } {
  const facing = blockingEntity.facing ?? { x: 1, y: 0 };
  const length = Math.hypot(facing.x, facing.y);
  if (length <= 0.001) return {
    x: blockingEntity.body.x + 1,
    y: blockingEntity.body.y,
  };
  return {
    x: blockingEntity.body.x + facing.x / length,
    y: blockingEntity.body.y + facing.y / length,
  };
}
