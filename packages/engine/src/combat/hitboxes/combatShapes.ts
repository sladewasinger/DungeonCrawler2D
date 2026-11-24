/** Canonical ground colliders, sprite-fitted hurtboxes, directional attack hitboxes, and overlap geometry. */
import type { EntityKind } from "../aiSensing.js";
import { COMBAT_TUNING, entityFootRadius, type EllipseHurtbox, type Vec2Like } from "../combatRules.js";
import { getWeaponStepSpec, resolveWeaponArchetype } from "../weapons/weaponMovesets.js";
import type { WorldChunkCache } from "../../world/collision.js";
import type { GroundColliderShape } from "../../world/propFootprints.js";
import {
  ENTITY_ATTACK_SPECS,
  ENTITY_HURTBOX_SPECS,
  type EntityAttackSpec,
  type HurtboxSpec,
} from "./creatureHitboxSpecs.js";
import {
  attackHitboxHitsHurtbox,
  canAttackReachElevation,
  canReachMeleeTarget,
  projectileHitsHurtbox,
  type AttackHitbox,
  type ProjectileHitQuery,
} from "./hitboxOverlap.js";

export {
  ENTITY_ATTACK_SPECS,
  ENTITY_HURTBOX_SPECS,
  attackHitboxHitsHurtbox,
  canAttackReachElevation,
  canReachMeleeTarget,
  projectileHitsHurtbox,
  type AttackHitbox,
  type EntityAttackSpec,
  type HurtboxSpec,
  type ProjectileHitQuery,
};

export interface ActorPositionInput extends Vec2Like {
  readonly elevation?: number | undefined;
  readonly onStairs?: boolean | undefined;
}

function resolveActorElevation(
  pos: ActorPositionInput,
  cache?: WorldChunkCache,
): { readonly elevation?: number; readonly onStairs?: boolean } {
  const stairs = pos.onStairs ?? (cache ? cache.tileAt(Math.floor(pos.x), Math.floor(pos.y)).stairs : false);
  return {
    ...(pos.elevation !== undefined ? { elevation: pos.elevation } : {}),
    ...(stairs ? { onStairs: true } : {}),
  };
}

export interface PlayerWeaponHitboxStats {
  readonly range?: number | undefined;
  readonly arcRad?: number | undefined;
  readonly weaponArchetype?: string | undefined;
}

const DEFAULT_ENTITY_HURTBOX: HurtboxSpec = { offsetY: -0.52, rx: 0.62, ry: 0.72 };

export const PLAYER_FOOT_FORESHORTEN_Y = 0.78;

export interface PlayerStanceInput {
  readonly facingX?: number | undefined;
  readonly facingY?: number | undefined;
  readonly aimX?: number | undefined;
  readonly aimY?: number | undefined;
  readonly heldItem?: string | null | undefined;
  readonly bowCharge?: number | undefined;
  readonly heavyCharge?: number | undefined;
}

function isAimLockedStance(snap: PlayerStanceInput): boolean {
  if ((snap.heavyCharge ?? 0) > 0) return true;
  return snap.heldItem === "bow" && (snap.bowCharge ?? 0) > 0.001;
}

function pickStanceVector(snap: PlayerStanceInput): Vec2Like {
  const fx = snap.facingX ?? 0;
  const fy = snap.facingY ?? 1;
  if (!isAimLockedStance(snap)) return { x: fx, y: fy };
  return { x: snap.aimX ?? fx, y: snap.aimY ?? fy };
}

/** Computes the quantized 8-way player stance half-segment perpendicular to sprite facing. */
export function playerFootSegment(snap: PlayerStanceInput): { readonly segX: number; readonly segY: number } {
  const v = pickStanceVector(snap);
  const raw = Math.hypot(v.x, v.y) > 1e-4 ? Math.atan2(v.y, v.x) : Math.PI * 0.5;
  const oct = Math.round(raw / (Math.PI * 0.25)) * (Math.PI * 0.25);
  const halfW = COMBAT_TUNING.movement.footHalfWidthTiles;
  return { segX: -Math.sin(oct) * halfW, segY: Math.cos(oct) * halfW * PLAYER_FOOT_FORESHORTEN_Y };
}

export function playerFootCollider(
  pos: Vec2Like & PlayerStanceInput & { readonly elevation?: number | undefined },
): GroundColliderShape {
  const seg = playerFootSegment(pos);
  return {
    x: pos.x,
    y: pos.y,
    radius: COMBAT_TUNING.movement.collisionRadiusTiles,
    halfX: Math.hypot(seg.segX, seg.segY),
    halfY: 0,
    angleRad: Math.atan2(seg.segY, seg.segX),
    elevation: pos.elevation ?? 0,
  };
}

export function entityFootCollider(
  pos: Vec2Like & { readonly elevation?: number | undefined },
  kind?: EntityKind,
): GroundColliderShape {
  return { x: pos.x, y: pos.y, radius: entityFootRadius(kind), halfX: 0, halfY: 0, elevation: pos.elevation ?? 0 };
}

export function entityHurtbox(pos: ActorPositionInput, kind?: EntityKind, cache?: WorldChunkCache): EllipseHurtbox {
  const spec = kind ? ENTITY_HURTBOX_SPECS[kind] : DEFAULT_ENTITY_HURTBOX;
  return { cx: pos.x, cy: pos.y + spec.offsetY, rx: spec.rx, ry: spec.ry, ...resolveActorElevation(pos, cache) };
}

export function playerHurtbox(pos: ActorPositionInput, cache?: WorldChunkCache): EllipseHurtbox {
  return { cx: pos.x, cy: pos.y - 0.44, rx: 0.48, ry: 0.62, ...resolveActorElevation(pos, cache) };
}

export const projectileHurtbox = entityHurtbox;
export const playerProjectileHurtbox = playerHurtbox;

export function getEntityAttackSpec(kind: EntityKind): EntityAttackSpec {
  return ENTITY_ATTACK_SPECS[kind];
}

function normalizeDir(dx: number, dy: number): Vec2Like {
  const mag = Math.hypot(dx, dy);
  return mag > 1e-4 ? { x: dx / mag, y: dy / mag } : { x: 0, y: 1 };
}

export function buildEntityAttackHitbox(
  entity: {
    readonly kind: EntityKind;
    readonly x: number;
    readonly y: number;
    readonly elevation?: number | undefined;
    readonly onStairs?: boolean | undefined;
    readonly facingX: number;
    readonly facingY: number;
  },
  cache?: WorldChunkCache,
): AttackHitbox {
  const spec = ENTITY_ATTACK_SPECS[entity.kind];
  const dir = normalizeDir(entity.facingX, entity.facingY);
  const elev = resolveActorElevation(entity, cache);
  return {
    x: entity.x + dir.x * spec.forwardOffset,
    y: entity.y + spec.originOffsetY + dir.y * spec.forwardOffset,
    dirX: dir.x,
    dirY: dir.y,
    range: spec.range,
    halfArcRad: spec.halfArcRad,
    elevation: entity.elevation ?? 0,
    ...(elev.onStairs ? { onStairs: true } : {}),
  };
}

export function resolveEntityAttackHitbox(snap: {
  readonly kind: EntityKind;
  readonly x: number;
  readonly y: number;
  readonly elevation: number;
  readonly facingX: number;
  readonly facingY: number;
  readonly telegraphProgress: number;
  readonly attackProgress?: number | undefined;
  readonly aiState?: string | undefined;
}): { readonly hitbox: AttackHitbox; readonly phase: "windup" | "active" } | null {
  if (ENTITY_ATTACK_SPECS[snap.kind].range <= 0) return null;
  if ((snap.attackProgress ?? 0) > 0 || (snap.aiState === "charge" && snap.telegraphProgress <= 0)) {
    return { hitbox: buildEntityAttackHitbox(snap), phase: "active" };
  }
  return snap.telegraphProgress > 0 ? { hitbox: buildEntityAttackHitbox(snap), phase: "windup" } : null;
}

export function buildPlayerAttackHitbox(opts: {
  readonly x: number;
  readonly y: number;
  readonly elevation?: number | undefined;
  readonly onStairs?: boolean | undefined;
  readonly cache?: WorldChunkCache | undefined;
  readonly dir: Vec2Like;
  readonly range: number;
  readonly halfArcRad: number;
  readonly impactCenter?: Vec2Like | undefined;
  readonly slamAoeRadius?: number | undefined;
}): AttackHitbox {
  const dir = normalizeDir(opts.dir.x, opts.dir.y);
  const elev = resolveActorElevation(opts, opts.cache);
  const slam = opts.impactCenter && opts.slamAoeRadius
    ? { slamCenter: { x: opts.impactCenter.x, y: opts.impactCenter.y - 0.44 }, slamRadius: opts.slamAoeRadius }
    : {};
  return {
    x: opts.x + dir.x * 0.12,
    y: opts.y - 0.44 + dir.y * 0.12,
    dirX: dir.x,
    dirY: dir.y,
    range: Math.max(0.75, opts.range - 0.38),
    halfArcRad: opts.halfArcRad,
    elevation: opts.elevation ?? 0,
    ...(elev.onStairs ? { onStairs: true } : {}),
    ...slam,
  };
}

function baseRangeAndArc(stats?: PlayerWeaponHitboxStats): { readonly range: number; readonly halfArc: number } {
  const range = stats?.range ?? 1.5;
  const arcRad = stats?.arcRad ?? 1.5;
  return { range, halfArc: arcRad * 0.5 };
}

function playerAimDir(snap: {
  readonly aimX?: number | undefined; readonly aimY?: number | undefined;
  readonly facingX: number; readonly facingY: number;
}): Vec2Like {
  return normalizeDir(snap.aimX ?? snap.facingX, snap.aimY ?? snap.facingY);
}

export function resolvePlayerAttackHitbox(
  snap: {
    readonly x: number; readonly y: number; readonly elevation: number;
    readonly facingX: number; readonly facingY: number;
    readonly aimX?: number | undefined; readonly aimY?: number | undefined;
    readonly heldItem?: string | null | undefined;
    readonly swingProgress?: number | undefined; readonly comboStep?: number | undefined;
  },
  itemStats?: PlayerWeaponHitboxStats,
): { readonly hitbox: AttackHitbox; readonly active: boolean } | null {
  const progress = snap.swingProgress;
  if (!progress || progress <= 0) return null;
  const archetype = resolveWeaponArchetype(snap.heldItem, itemStats?.weaponArchetype);
  const step = getWeaponStepSpec(archetype, Math.max(1, snap.comboStep ?? 1));
  const base = baseRangeAndArc(itemStats);
  const dir = playerAimDir(snap);
  const range = base.range * step.rangeMult;
  const impactCenter = step.slamAoeRadius ? { x: snap.x + dir.x * range * 0.72, y: snap.y + dir.y * range * 0.72 } : undefined;
  return {
    hitbox: buildPlayerAttackHitbox({
      x: snap.x, y: snap.y, elevation: snap.elevation, dir, range,
      halfArcRad: base.halfArc * step.arcMult, impactCenter, slamAoeRadius: step.slamAoeRadius,
    }),
    active: progress >= step.windupEnd && progress <= step.activeEnd,
  };
}
