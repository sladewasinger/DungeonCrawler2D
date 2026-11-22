/** Specialized archetype steering and combat helpers for wildlife & POI guards. */
import { AI_TUNING, WorldChunkCache, computeFlankRingSlot, isInSanctuary, resolveMovement } from "@dc2d/engine";
import {
  CREATURE_SPECS, ITEM_RAW_MEAT, ST_AMBUSH, ST_CHARGE, ST_CHASE, ST_FEED, ST_FLANK, ST_PATROL,
  type WildlifeEntity,
} from "./creatureSpecs.js";

export interface SteerTarget { readonly x: number; readonly y: number; readonly speedMult: number }
export interface CombatPlayerCandidate {
  readonly id: string; readonly x: number; readonly y: number; readonly elevation: number; readonly moving: boolean;
}
export interface EcologyFoodSource { readonly x: number; readonly y: number; readonly isMeatLoot?: boolean }
export type StrikePlayerFn = (entity: WildlifeEntity, target: CombatPlayerCandidate) => void;

export function moveCreatureToward(opts: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity;
  readonly tx: number; readonly ty: number; readonly speed: number; readonly dt: number;
}): void {
  const { cache, e, tx, ty, speed, dt } = opts;
  const dist = Math.hypot(tx - e.x, ty - e.y);
  if (dist < 0.08) return;
  const nx = (tx - e.x) / dist;
  const ny = (ty - e.y) / dist;
  e.facingX = nx;
  e.facingY = ny;
  const step = Math.min(dist, speed * dt);
  const res = resolveMovement({
    cache, x: e.x, y: e.y, dx: nx * step, dy: ny * step, radius: 0.28, elevation: e.elevation, airborne: false,
  });
  e.x = res.x;
  e.y = res.y;
  e.elevation = res.elevation;
}

export function stepWolfPack(opts: {
  readonly e: WildlifeEntity; readonly target: CombatPlayerCandidate;
  readonly entities: readonly WildlifeEntity[]; readonly timeSec: number; readonly onStrike: StrikePlayerFn;
}): SteerTarget {
  const { e, target, entities, timeSec, onStrike } = opts;
  const pack = entities.filter((m) => m.hp > 0 && m.packId !== null && m.packId === e.packId);
  const slotIdx = Math.max(0, pack.indexOf(e));
  const spec = CREATURE_SPECS.wolf;
  const dist = Math.hypot(target.x - e.x, target.y - e.y);
  if (e.attackCooldown <= 0 && dist <= spec.range + 0.35) {
    if (dist <= spec.range) onStrike(e, target);
    e.aiState = ST_CHASE;
    return { x: target.x, y: target.y, speedMult: 1.15 };
  }
  e.aiState = ST_FLANK;
  const ring = computeFlankRingSlot({
    centerX: target.x, centerY: target.y, slotIndex: slotIdx,
    packSize: Math.max(1, pack.length), ringRadius: AI_TUNING.wolfFlankRadiusTiles, phaseRad: timeSec * 0.45,
  });
  return { x: ring.x, y: ring.y, speedMult: 1.0 };
}

function findNearestFood(e: WildlifeEntity, foods: readonly EcologyFoodSource[]): { readonly food: EcologyFoodSource; readonly dist: number } | null {
  let food: EcologyFoodSource | null = null;
  let dist: number = AI_TUNING.bearScavengeRadiusTiles;
  for (const f of foods) {
    if (isInSanctuary(f.x, f.y)) continue;
    const d = Math.hypot(f.x - e.x, f.y - e.y);
    if (d < dist) { dist = d; food = f; }
  }
  return food ? { food, dist } : null;
}

export function stepBearScavenge(opts: {
  readonly e: WildlifeEntity; readonly foods: readonly EcologyFoodSource[]; readonly dt: number;
}): SteerTarget | null {
  const { e, foods, dt } = opts;
  e.hunger = Math.min(1, e.hunger + dt * 0.05);
  if (e.feedTimer > 0) {
    e.feedTimer = Math.max(0, e.feedTimer - dt);
    e.aiState = ST_FEED;
    return { x: e.x, y: e.y, speedMult: 0 };
  }
  const hit = e.hunger >= 0.35 || foods.length > 0 ? findNearestFood(e, foods) : null;
  if (!hit) return null;
  e.aiState = ST_FEED;
  if (hit.dist <= 0.95) {
    e.feedTimer = AI_TUNING.bearFeedDurationSec;
    e.hunger = 0;
    return { x: e.x, y: e.y, speedMult: 0 };
  }
  return { x: hit.food.x, y: hit.food.y, speedMult: 0.85 };
}

function beginBoarCharge(e: WildlifeEntity, target: CombatPlayerCandidate): void {
  const dx = target.x - e.x;
  const dy = target.y - e.y;
  const mag = Math.max(0.01, Math.hypot(dx, dy));
  e.facingX = dx / mag;
  e.facingY = dy / mag;
  e.chargeVx = e.facingX * CREATURE_SPECS.boar.speed * AI_TUNING.boarChargeSpeedMult;
  e.chargeVy = e.facingY * CREATURE_SPECS.boar.speed * AI_TUNING.boarChargeSpeedMult;
  e.chargeTimer = AI_TUNING.boarChargeDurationSec;
  e.chargeHitDealt = false;
  e.aiState = ST_CHARGE;
}

function advanceActiveBoarCharge(opts: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity;
  readonly target: CombatPlayerCandidate; readonly dt: number; readonly onStrike: StrikePlayerFn;
}): void {
  const { cache, e, target, dt, onStrike } = opts;
  e.chargeTimer = Math.max(0, e.chargeTimer - dt);
  e.aiState = ST_CHARGE;
  const res = resolveMovement({
    cache, x: e.x, y: e.y, dx: e.chargeVx * dt, dy: e.chargeVy * dt, radius: 0.3, elevation: e.elevation, airborne: false,
  });
  e.x = res.x;
  e.y = res.y;
  e.elevation = res.elevation;
  if (!e.chargeHitDealt && Math.hypot(target.x - e.x, target.y - e.y) <= CREATURE_SPECS.boar.range) {
    e.chargeHitDealt = true;
    onStrike(e, target);
  }
  if (e.chargeTimer === 0) e.attackCooldown = CREATURE_SPECS.boar.cooldownSec;
}

export function stepBoarBehavior(opts: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity;
  readonly target: CombatPlayerCandidate; readonly dt: number; readonly onStrike: StrikePlayerFn;
}): SteerTarget | null {
  const { e, target, dt } = opts;
  if (e.chargeTimer > 0) { advanceActiveBoarCharge(opts); return null; }
  if (e.telegraphTimer > 0) {
    e.telegraphTimer = Math.max(0, e.telegraphTimer - dt);
    e.aiState = ST_CHARGE;
    if (e.telegraphTimer === 0) beginBoarCharge(e, target);
    return null;
  }
  const dist = Math.hypot(target.x - e.x, target.y - e.y);
  if (e.attackCooldown <= 0 && dist <= 5.5 && dist >= 1.6) {
    e.telegraphTimer = AI_TUNING.boarWindupSec;
    e.windupDuration = AI_TUNING.boarWindupSec;
    e.aiState = ST_CHARGE;
    return null;
  }
  return { x: target.x, y: target.y, speedMult: 1.0 };
}

export function stepSpiderAmbushCheck(opts: {
  readonly e: WildlifeEntity; readonly target: CombatPlayerCandidate | null; readonly dayPhase: number;
}): boolean {
  if (!opts.target) { opts.e.aiState = ST_AMBUSH; return false; }
  const isNight = opts.dayPhase < 0.24 || opts.dayPhase > 0.76;
  const triggerDist = isNight ? AI_TUNING.spiderAmbushNightTiles : AI_TUNING.spiderAmbushDayTiles;
  const dist = Math.hypot(opts.target.x - opts.e.x, opts.target.y - opts.e.y);
  const alerted = opts.e.hitTimer > 0 || opts.e.alertedTimer > 0;
  if (dist <= triggerDist || alerted) return true;
  opts.e.aiState = ST_AMBUSH;
  return false;
}

export function stepHomePatrol(opts: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly timeSec: number; readonly dt: number;
}): void {
  const { cache, e, timeSec, dt } = opts;
  e.aiState = e.kind === "spider" ? ST_AMBUSH : ST_PATROL;
  if (e.kind === "spider") return;
  const angle = timeSec * 0.42 + e.patrolPhase;
  const r = Math.min(2.2, e.homeRadius * 0.5);
  moveCreatureToward({ cache, e, tx: e.homeX + Math.cos(angle) * r, ty: e.homeY + Math.sin(angle) * r, speed: CREATURE_SPECS[e.kind].speed * 0.45, dt });
}

export function isScavengeLootId(itemId: string): boolean {
  return itemId === ITEM_RAW_MEAT;
}
