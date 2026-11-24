/** Elevation-aware overlap and projectile intersection tests for hitboxes and hurtboxes. */
import { ELEVATION_LIFT_TILES, segmentHitsEllipse, type EllipseHurtbox, type Vec2Like } from "../combatRules.js";
import type { WorldChunkCache } from "../../world/collision.js";

export interface AttackHitbox {
  readonly x: number;
  readonly y: number;
  readonly dirX: number;
  readonly dirY: number;
  readonly range: number;
  readonly halfArcRad: number;
  readonly elevation: number;
  readonly onStairs?: boolean | undefined;
  readonly slamCenter?: Vec2Like | undefined;
  readonly slamRadius?: number | undefined;
}

export interface ProjectileHitQuery {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly projectileElevation: number;
  readonly projectileOnStairs?: boolean | undefined;
  readonly box: EllipseHurtbox;
}

export function canAttackReachElevation(opts: {
  readonly attackerElevation: number;
  readonly targetElevation: number;
  readonly attackerOnStairs?: boolean | undefined;
  readonly targetOnStairs?: boolean | undefined;
}): boolean {
  const diff = Math.abs(opts.attackerElevation - opts.targetElevation);
  if (diff === 0) return true;
  if (diff === 1) return Boolean(opts.attackerOnStairs || opts.targetOnStairs);
  return false;
}

export function canReachMeleeTarget(
  cache: WorldChunkCache,
  a: { readonly x: number; readonly y: number; readonly elevation: number },
  b: { readonly x: number; readonly y: number; readonly elevation: number },
): boolean {
  return canAttackReachElevation({
    attackerElevation: a.elevation,
    targetElevation: b.elevation,
    attackerOnStairs: cache.tileAt(Math.floor(a.x), Math.floor(a.y)).stairs,
    targetOnStairs: cache.tileAt(Math.floor(b.x), Math.floor(b.y)).stairs,
  });
}

function normalizeDir2(dx: number, dy: number): Vec2Like {
  const mag = Math.hypot(dx, dy);
  return mag > 1e-4 ? { x: dx / mag, y: dy / mag } : { x: 0, y: 1 };
}

function pointInEllipse(x: number, y: number, box: EllipseHurtbox): boolean {
  const nx = (x - box.cx) / Math.max(0.05, box.rx);
  const ny = (y - box.cy) / Math.max(0.05, box.ry);
  return nx * nx + ny * ny <= 1;
}

function rotateVec(dir: Vec2Like, angle: number): Vec2Like {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: dir.x * c - dir.y * s, y: dir.x * s + dir.y * c };
}

function sectorRayHits(opts: {
  readonly hitbox: AttackHitbox;
  readonly forward: Vec2Like;
  readonly rayDir: Vec2Like;
  readonly box: EllipseHurtbox;
}): boolean {
  const dot = opts.rayDir.x * opts.forward.x + opts.rayDir.y * opts.forward.y;
  if (dot < Math.cos(opts.hitbox.halfArcRad) - 1e-4) return false;
  return segmentHitsEllipse({
    x0: opts.hitbox.x,
    y0: opts.hitbox.y,
    x1: opts.hitbox.x + opts.rayDir.x * opts.hitbox.range,
    y1: opts.hitbox.y + opts.rayDir.y * opts.hitbox.range,
    box: opts.box,
  }) !== null;
}

function candidateSectorRays(hitbox: AttackHitbox, forward: Vec2Like, box: EllipseHurtbox): Vec2Like[] {
  const a = hitbox.halfArcRad;
  const cx = Math.max(box.cx - box.rx, Math.min(box.cx + box.rx, hitbox.x));
  const cy = Math.max(box.cy - box.ry, Math.min(box.cy + box.ry, hitbox.y));
  return [
    forward,
    rotateVec(forward, -a),
    rotateVec(forward, a),
    rotateVec(forward, -a * 0.5),
    rotateVec(forward, a * 0.5),
    normalizeDir2(box.cx - hitbox.x, box.cy - hitbox.y),
    normalizeDir2(cx - hitbox.x, cy - hitbox.y),
  ];
}

function sectorHitsEllipse(hitbox: AttackHitbox, box: EllipseHurtbox): boolean {
  if (hitbox.range <= 0) return false;
  const forward = normalizeDir2(hitbox.dirX, hitbox.dirY);
  const probeDist = Math.min(0.08, hitbox.range * 0.25);
  if (pointInEllipse(hitbox.x + forward.x * probeDist, hitbox.y + forward.y * probeDist, box)) return true;
  return candidateSectorRays(hitbox, forward, box).some((rayDir) => sectorRayHits({ hitbox, forward, rayDir, box }));
}

function slamHitsEllipse(hitbox: AttackHitbox, box: EllipseHurtbox): boolean {
  if (!hitbox.slamCenter || !hitbox.slamRadius) return false;
  const nx = (hitbox.slamCenter.x - box.cx) / (box.rx + hitbox.slamRadius);
  const ny = (hitbox.slamCenter.y - box.cy) / (box.ry + hitbox.slamRadius);
  return nx * nx + ny * ny <= 1;
}

export function attackHitboxHitsHurtbox(hitbox: AttackHitbox, box: EllipseHurtbox): boolean {
  if (
    box.elevation !== undefined
    && !canAttackReachElevation({
      attackerElevation: hitbox.elevation,
      targetElevation: box.elevation,
      attackerOnStairs: hitbox.onStairs,
      targetOnStairs: box.onStairs,
    })
  ) {
    return false;
  }
  return sectorHitsEllipse(hitbox, box) || slamHitsEllipse(hitbox, box);
}

export function projectileHitsHurtbox(q: ProjectileHitQuery): number | null {
  const targetElev = q.box.elevation ?? q.projectileElevation;
  const diff = targetElev - q.projectileElevation;
  if (diff > 0 && (diff !== 1 || !(q.projectileOnStairs || q.box.onStairs))) return null;
  const dyLift = q.projectileElevation > targetElev ? -(q.projectileElevation - targetElev) * ELEVATION_LIFT_TILES : 0;
  return segmentHitsEllipse({ x0: q.x0, y0: q.y0 + dyLift, x1: q.x1, y1: q.y1 + dyLift, box: q.box });
}
