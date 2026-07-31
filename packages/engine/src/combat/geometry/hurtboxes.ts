import type { Entity, EntityKind } from "../../entities/entity.js";

export { GUARD_COLLISION_RADIUS_TILES as SHIELD_COLLISION_RADIUS_TILES } from "./guardCollision.js";

/** Combat geometry is deliberately separate from sprite dimensions. */
export const PLAYER_HURTBOX_RADIUS = 0.2;
export const ENEMY_HURTBOX_RADIUS = 0.34;
export const DEFAULT_HURTBOX_RADIUS = 0.25;
/** Radius used for direct projectile contacts and attack-area interception. */
export const PROJECTILE_CONTACT_RADIUS = 0.25;

export function combatHurtboxRadius(entity: Pick<Entity, "kind"> | EntityKind): number {
  const kind = typeof entity === "string" ? entity : entity.kind;
  if (kind === "enemy") return ENEMY_HURTBOX_RADIUS;
  if (kind === "player") return PLAYER_HURTBOX_RADIUS;
  return DEFAULT_HURTBOX_RADIUS;
}

export function reachesHurtbox(
  attacker: Pick<Entity, "body">,
  target: Pick<Entity, "body" | "kind">,
  range: number,
): boolean {
  const distance = Math.hypot(
    target.body.x - attacker.body.x,
    target.body.y - attacker.body.y,
  );
  return distance - combatHurtboxRadius(target) <= range;
}
