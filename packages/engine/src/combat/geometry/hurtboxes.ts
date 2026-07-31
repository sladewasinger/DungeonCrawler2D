import type { Entity, EntityKind } from "../../entities/entity.js";

export { GUARD_COLLISION_RADIUS_TILES as SHIELD_COLLISION_RADIUS_TILES } from "./guardCollision.js";

/** World-horizontal, axis-aligned combat receiver dimensions in tiles. */
export interface CombatHurtbox {
  readonly halfWidth: number;
  readonly halfDepth: number;
}

export interface CombatHurtboxBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

type HurtboxEntity = Pick<Entity, "body" | "kind" | "combatHurtbox">;
type HurtboxDefinition = Pick<Entity, "kind" | "combatHurtbox"> | EntityKind;

/** Combat receivers are independent from movement bodies and sprite pixels. */
export const PLAYER_HURTBOX: CombatHurtbox = Object.freeze({
  halfWidth: 0.2,
  halfDepth: 0.2,
});
export const ENEMY_HURTBOX: CombatHurtbox = Object.freeze({
  halfWidth: 0.34,
  halfDepth: 0.34,
});
export const DEFAULT_HURTBOX: CombatHurtbox = Object.freeze({
  halfWidth: 0.25,
  halfDepth: 0.25,
});
/** Radius used for direct projectile contacts and attack-area interception. */
export const PROJECTILE_CONTACT_RADIUS = 0.25;

export function combatHurtbox(entity: HurtboxDefinition): CombatHurtbox {
  if (typeof entity !== "string" && entity.combatHurtbox) {
    return entity.combatHurtbox;
  }
  const kind = typeof entity === "string" ? entity : entity.kind;
  if (kind === "enemy") return ENEMY_HURTBOX;
  if (kind === "player") return PLAYER_HURTBOX;
  return DEFAULT_HURTBOX;
}

export function combatHurtboxBounds(entity: HurtboxEntity): CombatHurtboxBounds {
  const hurtbox = combatHurtbox(entity);
  return {
    minX: entity.body.x - hurtbox.halfWidth,
    maxX: entity.body.x + hurtbox.halfWidth,
    minY: entity.body.y - hurtbox.halfDepth,
    maxY: entity.body.y + hurtbox.halfDepth,
  };
}

export function reachesHurtbox(
  attacker: Pick<Entity, "body">,
  target: HurtboxEntity,
  range: number,
): boolean {
  return pointDistanceSquaredToHurtbox(attacker.body, target) <= range * range;
}

export function circleIntersectsHurtbox(
  center: { readonly x: number; readonly y: number },
  radius: number,
  target: HurtboxEntity,
): boolean {
  return pointDistanceSquaredToHurtbox(center, target) <= radius * radius;
}

export function pointDistanceSquaredToHurtbox(
  point: { readonly x: number; readonly y: number },
  target: HurtboxEntity,
): number {
  const bounds = combatHurtboxBounds(target);
  const dx = distanceOutsideInterval(point.x, bounds.minX, bounds.maxX);
  const dy = distanceOutsideInterval(point.y, bounds.minY, bounds.maxY);
  return dx * dx + dy * dy;
}

function distanceOutsideInterval(value: number, minimum: number, maximum: number): number {
  if (value < minimum) return minimum - value;
  if (value > maximum) return value - maximum;
  return 0;
}
