/** A* waypoint following, prop avoidance, true-velocity facing sync, and knockback physics. */
import { COMBAT_TUNING, ELEVATION_DROP_TO_JUMP_Z, GroundKind, WorldChunkCache, closestObstacleCorePoint, findTilePath, hasElevationLineOfSight, isInSanctuary, resolveMovement, stepJumpArc } from "@dc2d/engine";
import { CREATURE_SPECS, type WildlifeEntity } from "./creatureSpecs.js";

export interface MoveCreatureOpts {
  readonly cache: WorldChunkCache;
  readonly e: WildlifeEntity;
  readonly tx: number;
  readonly ty: number;
  readonly speed: number;
  readonly dt: number;
  readonly stopRadius?: number;
  readonly sep?: { readonly x: number; readonly y: number };
  readonly usePathfinding?: boolean;
}

interface SteerGoal {
  readonly tx: number;
  readonly ty: number;
  readonly stop: number;
}

const WAYPOINT_REACHED_DIST = 0.32;
const PATH_REFRESH_SEC = 0.36;
const KB_DECAY_RATE = 11.0;

export function faceTarget(e: WildlifeEntity, target: { readonly x: number; readonly y: number }): void {
  const dx = target.x - e.x;
  const dy = target.y - e.y;
  const mag = Math.hypot(dx, dy);
  if (mag <= 0.05) return;
  e.facingX = dx / mag;
  e.facingY = dy / mag;
}

export function clearNavPath(e: WildlifeEntity): void {
  e.navPath = [];
  e.navTimer = 0;
  e.navReachedGoal = true;
}

export function applyKnockbackImpulse(
  e: WildlifeEntity,
  impulse: { readonly dirX: number; readonly dirY: number; readonly force: number },
): void {
  const mag = Math.max(0.01, Math.hypot(impulse.dirX, impulse.dirY));
  const resist = CREATURE_SPECS[e.kind].knockbackResist;
  const speed = impulse.force * Math.max(0.08, 1 - resist);
  e.kbVx += (impulse.dirX / mag) * speed;
  e.kbVy += (impulse.dirY / mag) * speed;
}

export function applyEntityMoveResult(
  e: WildlifeEntity,
  res: { readonly x: number; readonly y: number; readonly elevation: number; readonly inWater: boolean; readonly inDeepWater: boolean },
): void {
  e.x = res.x; e.y = res.y; e.elevation = res.elevation;
  e.inWater = res.inWater; e.inDeepWater = res.inDeepWater;
}

export function stepKnockbackVelocity(cache: WorldChunkCache, e: WildlifeEntity, dt: number): boolean {
  if (Math.hypot(e.kbVx, e.kbVy) < 0.08) { e.kbVx = 0; e.kbVy = 0; return false; }
  const res = resolveMovement({ cache, x: e.x, y: e.y, dx: e.kbVx * dt, dy: e.kbVy * dt, radius: 0.28, elevation: e.elevation, airborne: false });
  applyEntityMoveResult(e, res);
  const decay = Math.exp(-KB_DECAY_RATE * dt);
  e.kbVx *= decay; e.kbVy *= decay;
  return true;
}

function computeStepVector(q: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity;
  readonly steer: SteerGoal; readonly speed: number; readonly dt: number;
  readonly sep?: { readonly x: number; readonly y: number } | undefined;
}): { readonly dx: number; readonly dy: number; readonly moveDist: number } {
  const steerDx = q.steer.tx - q.e.x;
  const steerDy = q.steer.ty - q.e.y;
  const steerDist = Math.hypot(steerDx, steerDy);
  const moveDist = steerDist > q.steer.stop ? Math.min(steerDist - q.steer.stop, q.speed * q.dt) : 0;
  const dirScale = moveDist > 0 && steerDist > 0.001 ? moveDist / steerDist : 0;
  const dir = { x: steerDist > 0.001 ? steerDx / steerDist : 0, y: steerDist > 0.001 ? steerDy / steerDist : 0 };
  const avoid = moveDist > 0 ? computeObstacleAvoidance(q.cache, q.e, dir) : { x: 0, y: 0 };
  const sep = q.sep ?? { x: 0, y: 0 };
  return {
    dx: steerDx * dirScale + (sep.x * 2.1 + avoid.x * 1.45) * q.dt,
    dy: steerDy * dirScale + (sep.y * 2.1 + avoid.y * 1.45) * q.dt,
    moveDist,
  };
}

function inReturnReaggroZone<T extends { readonly x: number; readonly y: number; readonly elevation: number }>(
  cache: WorldChunkCache, e: WildlifeEntity, p: T,
): boolean {
  const spec = CREATURE_SPECS[e.kind];
  const distSelf = Math.hypot(p.x - e.x, p.y - e.y);
  if (spec.territorialGuard) {
    return distSelf <= spec.visionRange && Math.hypot(p.x - e.homeX, p.y - e.homeY) <= e.homeRadius * 1.15;
  }
  if (distSelf > 4.5 || Math.abs(p.elevation - e.elevation) > 1 || e.navTimer > 0) return false;
  return findTilePath({ cache, startX: e.x, startY: e.y, goalX: p.x, goalY: p.y, maxRadiusTiles: 10 }).reachedGoal;
}

export function matchesReturnReaggro<
  T extends { readonly x: number; readonly y: number; readonly elevation: number; readonly combat?: { readonly cocoonProgress?: number } | undefined },
>(
  cache: WorldChunkCache, e: WildlifeEntity, p: T,
): boolean {
  if ((e.kind === "spider" && (p.combat?.cocoonProgress ?? 0) >= 1) || isInSanctuary(p.x, p.y) || !inReturnReaggroZone(cache, e, p)) return false;
  return hasElevationLineOfSight({ cache, fromX: e.x, fromY: e.y, fromElev: e.elevation, toX: p.x, toY: p.y, toElev: p.elevation });
}

export function findReturnReaggroPlayer<T extends { readonly x: number; readonly y: number; readonly elevation: number }>(opts: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly players: readonly T[];
}): T | null {
  return opts.players.find((p) => matchesReturnReaggro(opts.cache, opts.e, p)) ?? null;
}

function shouldJumpLedge(cache: WorldChunkCache, e: WildlifeEntity, step: { readonly dx: number; readonly dy: number }): boolean {
  if (e.jumpZ > 0.01 || e.inDeepWater) return false;
  const mag = Math.hypot(step.dx, step.dy);
  if (mag <= 0.002) return false;
  const curTile = cache.tileAt(Math.floor(e.x), Math.floor(e.y));
  const nextTile = cache.tileAt(Math.floor(e.x + (step.dx / mag) * 0.48), Math.floor(e.y + (step.dy / mag) * 0.48));
  return !curTile.stairs && !nextTile.stairs && Math.abs(nextTile.elevation - e.elevation) === 1;
}

export function stepIdleJumpArc(e: WildlifeEntity, dt: number): void {
  if (e.jumpStepped || (e.jumpZ <= 0 && e.jumpVz <= 0)) {
    e.jumpStepped = false;
    return;
  }
  const arc = stepJumpArc({ jumpZ: e.jumpZ, jumpVz: e.jumpVz }, false, dt);
  e.jumpZ = arc.jumpZ;
  e.jumpVz = arc.jumpVz;
  e.jumpStepped = false;
}

export function syncCreatureWaterState(cache: WorldChunkCache, e: WildlifeEntity): void {
  const ground = cache.tileAt(Math.floor(e.x), Math.floor(e.y)).ground;
  e.inDeepWater = ground === GroundKind.DeepWater;
  e.inWater = e.inDeepWater || ground === GroundKind.ShallowWater;
}

export function creatureWaterSpeedMult(e: Pick<WildlifeEntity, "inWater" | "inDeepWater">): number {
  if (e.inDeepWater) return COMBAT_TUNING.movementMults.deepWater * 0.82;
  return e.inWater ? COMBAT_TUNING.movementMults.shallowWater : 1;
}

export function moveCreatureToward(opts: MoveCreatureOpts): void {
  const { cache, e, tx, ty, dt } = opts;
  const speed = opts.speed * creatureWaterSpeedMult(e);
  const stopR = opts.stopRadius ?? 0.08;
  const directDist = Math.hypot(tx - e.x, ty - e.y);
  const steer = resolveSteerGoal({ cache, e, tx, ty, stopR, directDist, usePathfinding: opts.usePathfinding !== false });
  const step = computeStepVector({ cache, e, steer, speed, dt, sep: opts.sep });
  const wantsJump = shouldJumpLedge(cache, e, step);
  const arc = stepJumpArc({ jumpZ: e.jumpZ, jumpVz: e.jumpVz }, wantsJump, dt);
  e.jumpZ = arc.jumpZ;
  e.jumpVz = arc.jumpVz;
  e.jumpStepped = true;
  if (Math.hypot(step.dx, step.dy) < 0.002) {
    if (directDist > 0.12) faceTarget(e, { x: tx, y: ty });
    return;
  }
  applyResolvedStep({ cache, e, dx: step.dx, dy: step.dy, moveDist: step.moveDist, target: { x: tx, y: ty } });
}

function applyResolvedStep(step: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity;
  readonly dx: number; readonly dy: number; readonly moveDist: number;
  readonly target: { readonly x: number; readonly y: number };
}): void {
  const { cache, e, dx, dy, moveDist, target } = step;
  const res = resolveMovement({
    cache, x: e.x, y: e.y, dx, dy, radius: 0.28, elevation: e.elevation, airborne: e.jumpZ > 0.02, jumpZ: e.jumpZ,
  });
  const actualDx = res.x - e.x; const actualDy = res.y - e.y;
  const actualMag = Math.hypot(actualDx, actualDy);
  applyEntityMoveResult(e, res);
  if (res.elevationDrop !== 0) e.jumpZ = Math.max(0, e.jumpZ + res.elevationDrop * ELEVATION_DROP_TO_JUMP_Z);
  if (moveDist > 0.002 && actualMag > 0.008) {
    e.facingX = actualDx / actualMag;
    e.facingY = actualDy / actualMag;
  } else if (Math.hypot(target.x - e.x, target.y - e.y) > 0.12) {
    faceTarget(e, target);
  }
}

function resolveSteerGoal(q: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity;
  readonly tx: number; readonly ty: number; readonly stopR: number;
  readonly directDist: number; readonly usePathfinding: boolean;
}): SteerGoal {
  if (!q.usePathfinding || q.directDist <= Math.max(q.stopR, 0.35)) {
    return { tx: q.tx, ty: q.ty, stop: q.stopR };
  }
  refreshPathIfNeeded(q.cache, q.e, { x: q.tx, y: q.ty });
  pruneReachedWaypoints(q.e);
  const next = q.e.navPath[0];
  if (!q.e.navReachedGoal) {
    return next ? { tx: next.x, ty: next.y, stop: 0.22 } : { tx: q.e.x, ty: q.e.y, stop: 0 };
  }
  if (q.e.navPath.length <= 1) return { tx: q.tx, ty: q.ty, stop: q.stopR };
  return next ? { tx: next.x, ty: next.y, stop: 0.04 } : { tx: q.tx, ty: q.ty, stop: q.stopR };
}

function refreshPathIfNeeded(cache: WorldChunkCache, e: WildlifeEntity, goal: { readonly x: number; readonly y: number }): void {
  const goalShifted = Math.hypot(goal.x - e.navGoalX, goal.y - e.navGoalY) > 1.25;
  const needReachable = e.navReachedGoal && e.navPath.length === 0 && Math.hypot(goal.x - e.x, goal.y - e.y) > 0.75;
  if (e.navTimer > 0 && !goalShifted && !needReachable) return;
  const res = findTilePath({
    cache, startX: e.x, startY: e.y, goalX: goal.x, goalY: goal.y, agentRadius: 0.34, maxRadiusTiles: 22, maxNodes: 900,
  });
  e.navPath = res.waypoints;
  e.navGoalX = goal.x;
  e.navGoalY = goal.y;
  e.navReachedGoal = res.reachedGoal;
  e.navTimer = PATH_REFRESH_SEC;
}

function pruneReachedWaypoints(e: WildlifeEntity): void {
  let drop = 0;
  const minKeep = e.navReachedGoal ? 1 : 0;
  while (e.navPath.length - drop > minKeep) {
    const wp = e.navPath[drop];
    if (!wp || Math.hypot(wp.x - e.x, wp.y - e.y) >= WAYPOINT_REACHED_DIST) break;
    drop++;
  }
  if (drop > 0) e.navPath = e.navPath.slice(drop);
}

export function isClearSpot(
  cache: WorldChunkCache,
  pos: { readonly x: number; readonly y: number; readonly pad: number },
): boolean {
  const ground = cache.tileAt(pos.x, pos.y).ground;
  if (ground === GroundKind.DeepWater || ground === GroundKind.ShallowWater) return false;
  for (const obs of cache.blockingObstaclesNear(pos.x, pos.y)) {
    const core = closestObstacleCorePoint(obs, { x: pos.x, y: pos.y });
    if (Math.hypot(pos.x - core.x, pos.y - core.y) < obs.radius + pos.pad) return false;
  }
  return true;
}

function tangentialBias(opts: {
  readonly nx: number; readonly ny: number; readonly dir: { readonly x: number; readonly y: number };
  readonly tieSign: number; readonly mag: number;
}): { readonly x: number; readonly y: number } {
  const forwardDot = -(opts.nx * opts.dir.x + opts.ny * opts.dir.y);
  if (forwardDot <= 0.25) return { x: 0, y: 0 };
  const perpX = -opts.ny; const perpY = opts.nx;
  const cross = opts.dir.x * perpX + opts.dir.y * perpY;
  const sign = Math.abs(cross) > 0.08 ? Math.sign(cross) : opts.tieSign;
  return { x: perpX * sign * opts.mag, y: perpY * sign * opts.mag };
}

function computeObstacleAvoidance(
  cache: WorldChunkCache,
  e: WildlifeEntity,
  dir: { readonly x: number; readonly y: number },
): { readonly x: number; readonly y: number } {
  let ax = 0; let ay = 0;
  const tieSign = e.packSlot % 2 === 0 ? 1 : -1;
  for (const obs of cache.blockingObstaclesNear(e.x, e.y)) {
    const core = closestObstacleCorePoint(obs, { x: e.x, y: e.y });
    const dx = e.x - core.x; const dy = e.y - core.y;
    const d = Math.hypot(dx, dy);
    const thresh = obs.radius + 0.64;
    if (d <= 0.01 || d >= thresh) continue;
    const push = thresh - d;
    const nx = dx / d; const ny = dy / d;
    const tang = tangentialBias({ nx, ny, dir, tieSign, mag: push * 1.15 });
    ax += nx * push + tang.x; ay += ny * push + tang.y;
  }
  return { x: ax, y: ay };
}
