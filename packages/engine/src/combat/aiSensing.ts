/** Pure cognitive AI sensing, elevation-aware line of sight, and ecological tuning constants. */
import type { WorldChunkCache } from "../world/collision.js";
import { PropKind } from "../world/types.js";

export const ENTITY_KINDS = [
  "dummy", "slime-dummy", "spar-dummy",
  "wolf", "bear", "spider", "boar", "slime",
  "goblin", "orc", "skeleton", "golem",
] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

export const AI_STATES = [
  "idle", "patrol", "alert", "investigate", "chase", "flank", "charge", "ambush", "feed", "return", "dead",
] as const;
export type AiState = (typeof AI_STATES)[number];

export const AI_TUNING = {
  visionRangeTiles: 9.0,
  halfConeRad: 1.05,
  hearRangeTiles: 3.4,
  scentRadiusTiles: 6.5,
  scentMaxAgeSec: 14.0,
  investigateDurationSec: 5.0,
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

const LOS_BLOCKING_PROPS = new Set<PropKind>([
  PropKind.Boulder,
  PropKind.Palisade,
  PropKind.RuinPillar,
  PropKind.Tent,
]);

export interface LosQuery {
  readonly cache: WorldChunkCache;
  readonly fromX: number;
  readonly fromY: number;
  readonly fromElev: number;
  readonly toX: number;
  readonly toY: number;
  readonly toElev: number;
}

function hasPropOcclusion(cache: WorldChunkCache, ray: { readonly ax: number; readonly ay: number; readonly bx: number; readonly by: number }): boolean {
  const rx = ray.bx - ray.ax;
  const ry = ray.by - ray.ay;
  const lenSq = rx * rx + ry * ry;
  if (lenSq < 0.01) return false;
  for (const p of cache.propsNear(ray.ax, ray.ay)) {
    if (!LOS_BLOCKING_PROPS.has(p.kind)) continue;
    const t = Math.max(0.05, Math.min(0.95, ((p.x - ray.ax) * rx + (p.y - ray.ay) * ry) / lenSq));
    const cx = ray.ax + rx * t;
    const cy = ray.ay + ry * t;
    const r = Math.max(0.28, p.radius * 0.85);
    if (Math.hypot(p.x - cx, p.y - cy) < r) return true;
  }
  return false;
}

export function hasElevationLineOfSight(opts: LosQuery): boolean {
  const dx = opts.toX - opts.fromX;
  const dy = opts.toY - opts.fromY;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.5) return true;
  const ceiling = Math.max(opts.fromElev, opts.toElev);
  const steps = Math.ceil(dist * 2);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const tx = Math.floor(opts.fromX + dx * t);
    const ty = Math.floor(opts.fromY + dy * t);
    if (opts.cache.tileAt(tx, ty).elevation > ceiling) return false;
  }
  return !hasPropOcclusion(opts.cache, { ax: opts.fromX, ay: opts.fromY, bx: opts.toX, by: opts.toY });
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

export function canPerceiveTarget(opts: PerceptionQuery): boolean {
  const { observer, target } = opts;
  const dx = target.x - observer.x;
  const dy = target.y - observer.y;
  const dist = Math.hypot(dx, dy);
  const effectiveVision = opts.visionRange * (0.32 + 0.68 * (target.visibility ?? 1));
  if (dist > Math.max(effectiveVision, resolveEffectiveHear(opts))) return false;
  if (dist <= resolveEffectiveHear(opts)) {
    return Math.abs(observer.elevation - target.elevation) <= 1;
  }
  const dirMag = Math.max(0.01, Math.hypot(observer.facingX, observer.facingY));
  const cosAngle = (dx * observer.facingX + dy * observer.facingY) / (dist * dirMag);
  if (cosAngle < Math.cos(opts.halfConeRad)) return false;
  return hasElevationLineOfSight({
    cache: opts.cache,
    fromX: observer.x, fromY: observer.y, fromElev: observer.elevation,
    toX: target.x, toY: target.y, toElev: target.elevation,
  });
}

export function computeFlankRingSlot(opts: {
  readonly centerX: number;
  readonly centerY: number;
  readonly slotIndex: number;
  readonly packSize: number;
  readonly ringRadius: number;
  readonly phaseRad: number;
}): { readonly x: number; readonly y: number } {
  const count = Math.max(1, opts.packSize);
  const angle = opts.phaseRad + (opts.slotIndex / count) * Math.PI * 2;
  return {
    x: opts.centerX + Math.cos(angle) * opts.ringRadius,
    y: opts.centerY + Math.sin(angle) * opts.ringRadius,
  };
}
