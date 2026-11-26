/** Pure cognitive AI sensing, elevation-aware line of sight, and ecological tuning constants. */
import { PROP_SPECS } from "@dc2d/content";
import { AI_STATES, ENTITY_KINDS, GroundKind, PropKind, type AiState, type EntityKind } from "@dc2d/contracts";
import type { BlockingObstacle, WorldChunkCache } from "../world/collision.js";
import { closestObstacleCorePoint } from "../world/propFootprints.js";

export { AI_STATES, ENTITY_KINDS };
export type { AiState, EntityKind };

export const AI_TUNING = {
  visionRangeTiles: 9.0,
  halfConeRad: 1.05,
  hearRangeTiles: 3.4,
  scentRadiusTiles: 3.6,
  scentMaxAgeSec: 22.0,
  investigateDurationSec: 8.5,
  losGraceSec: 0.45,
  scentPatienceCapSec: 22.0,
  coldTrailSearchSec: 15.0,
  bodyScentRadiusTiles: 2.2,
  waterScentWashSec: 3.0,
  campfireMaskRadiusTiles: 2.5,
  wolfFlankRadiusTiles: 2.1,
  bearScavengeRadiusTiles: 9.0,
  bearFeedDurationSec: 5.5,
  boarWindupSec: 0.65,
  boarChargeSpeedMult: 2.3,
  boarChargeDurationSec: 1.35,
  spiderAmbushDayTiles: 4.2,
  spiderAmbushNightTiles: 6.0,
  corpseDurationSec: 18.0,
  lootMagnetRadiusTiles: 2.4,
  lootPickupRadiusTiles: 0.68,
  chestInteractRadiusTiles: 2.2,
  maxActiveWildlife: 28,
} as const;

export interface LosQuery {
  readonly cache: WorldChunkCache;
  readonly fromX: number;
  readonly fromY: number;
  readonly fromElev: number;
  readonly toX: number;
  readonly toY: number;
  readonly toElev: number;
}

const HARD_BLOCK_OCCLUSION = 1.0;
const FULL_OCCLUSION_CUTOFF = 0.92;

function propOcclusionRadius(p: { readonly kind: PropKind; readonly radius: number }): number {
  if (p.kind === PropKind.Palisade || p.kind === PropKind.Boulder) return Math.min(0.22, p.radius * 0.46);
  return Math.max(0.24, p.radius * 0.72);
}

function propRayOcclusionWeight(
  p: { readonly kind: PropKind; readonly x: number; readonly y: number; readonly radius: number; readonly elevation: number },
  ray: { readonly ax: number; readonly ay: number; readonly rx: number; readonly ry: number; readonly lenSq: number; readonly minElev: number; readonly maxElev: number },
): number {
  if (p.elevation < ray.minElev || p.elevation > ray.maxElev) return 0;
  const t = Math.max(0.08, Math.min(0.92, ((p.x - ray.ax) * ray.rx + (p.y - ray.ay) * ray.ry) / ray.lenSq));
  const dist = Math.hypot(p.x - (ray.ax + ray.rx * t), p.y - (ray.ay + ray.ry * t));
  const spec = PROP_SPECS[p.kind];
  if (spec.blocksLineOfSight) return dist < propOcclusionRadius(p) ? HARD_BLOCK_OCCLUSION : 0;
  return spec.foliageOcclusion && dist < spec.foliageOcclusion.radius ? spec.foliageOcclusion.weight : 0;
}

function computePropOcclusion(cache: WorldChunkCache, ray: { readonly ax: number; readonly ay: number; readonly bx: number; readonly by: number; readonly minElev: number; readonly maxElev: number }): number {
  const rx = ray.bx - ray.ax;
  const ry = ray.by - ray.ay;
  const lenSq = rx * rx + ry * ry;
  if (lenSq < 0.01) return 0;
  const mx = (ray.ax + ray.bx) * 0.5;
  const my = (ray.ay + ray.by) * 0.5;
  const seg = { ax: ray.ax, ay: ray.ay, rx, ry, lenSq, minElev: ray.minElev, maxElev: ray.maxElev };
  let occlusion = 0;
  for (const p of cache.propsNear(mx, my)) {
    occlusion += propRayOcclusionWeight(p, seg);
    if (occlusion >= FULL_OCCLUSION_CUTOFF) return 1;
  }
  return occlusion;
}

export function computeLineOfSightClarity(opts: LosQuery): number {
  const dx = opts.toX - opts.fromX;
  const dy = opts.toY - opts.fromY;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.5) return 1;
  const ceiling = Math.max(opts.fromElev, opts.toElev);
  const steps = Math.ceil(dist * 2);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const tx = Math.floor(opts.fromX + dx * t);
    const ty = Math.floor(opts.fromY + dy * t);
    if (opts.cache.tileAt(tx, ty).elevation > ceiling) return 0;
  }
  const occlusion = computePropOcclusion(opts.cache, {
    ax: opts.fromX, ay: opts.fromY, bx: opts.toX, by: opts.toY,
    minElev: Math.min(opts.fromElev, opts.toElev), maxElev: ceiling,
  });
  return occlusion >= FULL_OCCLUSION_CUTOFF ? 0 : Math.max(0, 1 - occlusion);
}

export function hasElevationLineOfSight(opts: LosQuery): boolean {
  return computeLineOfSightClarity(opts) > 0.08;
}

export interface PerceptionQuery {
  readonly cache: WorldChunkCache;
  readonly observer: {
    readonly x: number;
    readonly y: number;
    readonly elevation: number;
    readonly facingX: number;
    readonly facingY: number;
  };
  readonly target: {
    readonly x: number;
    readonly y: number;
    readonly elevation: number;
    readonly moving: boolean;
    readonly visibility?: number | undefined;
    readonly noiseRadius?: number | undefined;
  };
  readonly visionRange: number;
  readonly halfConeRad: number;
  readonly hearRange: number;
}

function resolveEffectiveHear(opts: PerceptionQuery): number {
  const nr = opts.target.noiseRadius;
  if (nr !== undefined) return Math.min(opts.hearRange * 1.65, nr);
  return opts.target.moving ? opts.hearRange : opts.hearRange * 0.55;
}

function isCloseFrontalSight(opts: { readonly observer: PerceptionQuery["observer"]; readonly target: PerceptionQuery["target"]; readonly dist: number }): boolean {
  return opts.dist <= 2.8 && (opts.target.visibility ?? 1) >= 0.45 && Math.abs(opts.observer.elevation - opts.target.elevation) <= 1;
}

export function canHearTarget(opts: PerceptionQuery): boolean {
  const dist = Math.hypot(opts.target.x - opts.observer.x, opts.target.y - opts.observer.y);
  return dist <= resolveEffectiveHear(opts) && Math.abs(opts.observer.elevation - opts.target.elevation) <= 1;
}

export function canPerceiveTarget(opts: PerceptionQuery): boolean {
  if (canHearTarget(opts)) return true;
  const { observer, target } = opts;
  const dx = target.x - observer.x; const dy = target.y - observer.y;
  const dist = Math.hypot(dx, dy);
  const effectiveVision = opts.visionRange * (0.32 + 0.68 * (target.visibility ?? 1));
  if (dist < 0.01 || dist > effectiveVision) return false;
  const dirMag = Math.max(0.01, Math.hypot(observer.facingX, observer.facingY));
  if ((dx * observer.facingX + dy * observer.facingY) / (dist * dirMag) < Math.cos(opts.halfConeRad)) return false;
  if (isCloseFrontalSight({ observer, target, dist })) return true;
  const clarity = computeLineOfSightClarity({
    cache: opts.cache, fromX: observer.x, fromY: observer.y, fromElev: observer.elevation,
    toX: target.x, toY: target.y, toElev: target.elevation,
  });
  return clarity > 0.08 && dist <= effectiveVision * (0.35 + 0.65 * clarity);
}

export function computeFlankRingSlot(opts: {
  readonly centerX: number; readonly centerY: number; readonly slotIndex: number;
  readonly packSize: number; readonly ringRadius: number; readonly phaseRad: number;
}): { readonly x: number; readonly y: number } {
  const angle = opts.phaseRad + (opts.slotIndex / Math.max(1, opts.packSize)) * Math.PI * 2;
  return { x: opts.centerX + Math.cos(angle) * opts.ringRadius, y: opts.centerY + Math.sin(angle) * opts.ringRadius };
}

export interface ChargeLaneQuery {
  readonly cache: WorldChunkCache;
  readonly from: { readonly x: number; readonly y: number; readonly elevation: number };
  readonly to: { readonly x: number; readonly y: number; readonly elevation: number };
  readonly radius?: number | undefined;
}

function isLaneTerrainBlocked(
  cache: WorldChunkCache,
  pt: { readonly x: number; readonly y: number; readonly elev: number },
): boolean {
  const tile = cache.tileAt(Math.floor(pt.x), Math.floor(pt.y));
  return tile.elevation !== pt.elev || tile.ground === GroundKind.DeepWater;
}

function isSamplePointClear(opts: {
  readonly cache: WorldChunkCache;
  readonly x: number;
  readonly y: number;
  readonly px: number;
  readonly py: number;
  readonly elev: number;
  readonly radius: number;
}): boolean {
  const { cache, x, y, px, py, elev, radius } = opts;
  const probes = [
    { x, y }, { x: x + px * radius, y: y + py * radius }, { x: x - px * radius, y: y - py * radius },
    { x, y: y - 0.14 }, { x, y: y + 0.14 },
  ];
  return probes.every((p) => !isLaneTerrainBlocked(cache, { ...p, elev }));
}

function isSampleObstacleClear(
  obstacles: readonly BlockingObstacle[],
  pt: { readonly x: number; readonly y: number },
  radius: number,
): boolean {
  for (const obs of obstacles) {
    const core = closestObstacleCorePoint(obs, pt);
    if (Math.hypot(pt.x - core.x, pt.y - core.y) < obs.radius + radius) return false;
  }
  return true;
}

function isSampleStepClear(opts: {
  readonly cache: WorldChunkCache;
  readonly obstacles: readonly BlockingObstacle[];
  readonly x: number;
  readonly y: number;
  readonly px: number;
  readonly py: number;
  readonly elev: number;
  readonly radius: number;
}): boolean {
  return isSamplePointClear(opts) && isSampleObstacleClear(opts.obstacles, { x: opts.x, y: opts.y }, opts.radius);
}

export function hasClearChargeLane(q: ChargeLaneQuery): boolean {
  if (q.from.elevation !== q.to.elevation) return false;
  const dx = q.to.x - q.from.x;
  const dy = q.to.y - q.from.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.6) return false;
  const ux = dx / dist;
  const uy = dy / dist;
  const radius = q.radius ?? 0.3;
  const endD = Math.max(0.65, dist - 0.35);
  const steps = Math.max(2, Math.ceil((endD - 0.32) / 0.35));
  const obstacles = q.cache.blockingObstaclesNear((q.from.x + q.to.x) * 0.5, (q.from.y + q.to.y) * 0.5)
    .filter((obs) => obs.elevation === q.from.elevation);
  for (let i = 0; i <= steps; i++) {
    const d = 0.32 + ((endD - 0.32) * i) / steps;
    if (!isSampleStepClear({ cache: q.cache, obstacles, x: q.from.x + ux * d, y: q.from.y + uy * d, px: -uy, py: ux, elev: q.from.elevation, radius })) {
      return false;
    }
  }
  return true;
}
