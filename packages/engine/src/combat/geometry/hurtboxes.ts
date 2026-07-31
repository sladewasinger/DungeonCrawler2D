import type { Entity, EntityKind } from "../../entities/entity.js";
import { COMBAT_HURTBOX_TUNING } from "./combatHurtboxTuning.js";

export { GUARD_COLLISION_RADIUS_TILES as SHIELD_COLLISION_RADIUS_TILES } from "./guardCollision.js";

/** Axis-aligned receiver hurtbox dimensions in world tiles. */
export interface CombatHurtbox {
  readonly halfWidth: number;
  readonly halfDepth: number;
  /** Upright body height; optional only for legacy hand-built fixtures. */
  readonly height?: number;
  /** Positive expands below the feet; negative insets above them. */
  readonly bottomOffset?: number;
}

export interface ResolvedCombatHurtbox extends CombatHurtbox {
  readonly height: number;
  readonly bottomOffset: number;
}

export interface CombatHurtboxBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
}

type HurtboxEntity = Pick<Entity, "body" | "kind" | "combatHurtbox">;
type HurtboxDefinition = Pick<Entity, "kind" | "combatHurtbox"> | EntityKind;

/** Hurtbox volumes are sprite-fitted but remain independent from movement collision. */
export const PLAYER_HURTBOX: ResolvedCombatHurtbox = Object.freeze({
  ...COMBAT_HURTBOX_TUNING.player,
});
export const ENEMY_HURTBOX: ResolvedCombatHurtbox = Object.freeze({
  ...COMBAT_HURTBOX_TUNING.enemy,
});
export const DEFAULT_HURTBOX: ResolvedCombatHurtbox = Object.freeze({
  ...COMBAT_HURTBOX_TUNING.default,
});
/** Radius used for direct projectile contacts and weapon-hitbox interception. */
export const PROJECTILE_CONTACT_RADIUS = 0.25;

export function combatHurtbox(entity: HurtboxDefinition): ResolvedCombatHurtbox {
  if (typeof entity !== "string" && entity.combatHurtbox) {
    return resolveAuthoredHurtbox(entity.combatHurtbox, fallbackHurtbox(entity.kind));
  }
  const kind = typeof entity === "string" ? entity : entity.kind;
  return fallbackHurtbox(kind);
}

function fallbackHurtbox(kind: EntityKind): ResolvedCombatHurtbox {
  if (kind === "enemy") return ENEMY_HURTBOX;
  if (kind === "player") return PLAYER_HURTBOX;
  return DEFAULT_HURTBOX;
}

function resolveAuthoredHurtbox(
  hurtbox: CombatHurtbox,
  fallback: ResolvedCombatHurtbox,
): ResolvedCombatHurtbox {
  return {
    ...hurtbox,
    height: hurtbox.height ?? fallback.height,
    bottomOffset: hurtbox.bottomOffset ?? fallback.bottomOffset,
  };
}

export function combatHurtboxBounds(entity: HurtboxEntity): CombatHurtboxBounds {
  const hurtbox = combatHurtbox(entity);
  const minZ = entity.body.z - hurtbox.bottomOffset;
  return {
    minX: entity.body.x - hurtbox.halfWidth,
    maxX: entity.body.x + hurtbox.halfWidth,
    minY: entity.body.y - hurtbox.halfDepth,
    maxY: entity.body.y + hurtbox.halfDepth,
    minZ,
    maxZ: minZ + hurtbox.height,
  };
}

/** True when an authoritative vertical attack/contact band reaches the hurtbox. */
export function verticalRangeIntersectsHurtbox(
  minimumZ: number,
  maximumZ: number,
  target: HurtboxEntity,
): boolean {
  const bounds = combatHurtboxBounds(target);
  return maximumZ >= bounds.minZ && minimumZ <= bounds.maxZ;
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
