/** Specialized archetype steering, separation, and combat helpers for wildlife & POI guards. */
import { AI_TUNING, GroundKind, PropKind, WorldChunkCache, computeFlankRingSlot, hashUnit2d, isInSanctuary, resolveMovement, type AiState, type WorldEvent } from "@dc2d/engine";
import {
  CREATURE_SPECS, ITEM_RAW_MEAT, ST_AMBUSH, ST_CHARGE, ST_CHASE, ST_FEED, ST_FLANK, ST_IDLE, ST_PATROL,
  type WildlifeEntity,
} from "./creatureSpecs.js";
import { faceTarget, isClearSpot, moveCreatureToward } from "./creatureNavigation.js";

const SPIDER_COVER_PROPS = new Set<PropKind>([PropKind.TallGrass, PropKind.Bush, PropKind.OakTree, PropKind.PineTree]);

export { moveCreatureToward };

export interface SteerTarget { readonly x: number; readonly y: number; readonly speedMult: number }
export interface CombatPlayerCandidate {
  readonly id: string; readonly x: number; readonly y: number; readonly elevation: number; readonly moving: boolean;
}
export interface EcologyFoodSource { readonly x: number; readonly y: number; readonly isMeatLoot?: boolean }
export type StrikePlayerFn = (entity: WildlifeEntity, target: CombatPlayerCandidate) => void;
export type BoarAction =
  | { readonly mode: "done" }
  | { readonly mode: "melee" }
  | { readonly mode: "steer"; readonly steer: SteerTarget };

export function computeSeparation(e: WildlifeEntity, entities: readonly WildlifeEntity[]): { readonly x: number; readonly y: number } {
  let sx = 0;
  let sy = 0;
  for (const other of entities) {
    if (other.corpse || other.hp <= 0 || other.id === e.id) continue;
    const dx = e.x - other.x;
    const dy = e.y - other.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.01 && d < 0.95) {
      const push = (0.95 - d) / d;
      sx += dx * push;
      sy += dy * push;
    }
  }
  return { x: sx, y: sy };
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

function beginBoarCharge(e: WildlifeEntity, target: CombatPlayerCandidate, events: WorldEvent[]): void {
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
  events.push({ kind: "creatureVocal", x: e.x, y: e.y, dirX: e.facingX, dirY: e.facingY, actorId: e.id, entityKind: e.kind, vocalKind: "charge" });
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
  if (e.chargeTimer === 0) {
    e.chargeRecoverTimer = 1.15;
    e.aiState = ST_IDLE;
    e.attackCooldown = CREATURE_SPECS.boar.cooldownSec;
  }
}

function advanceBoarRecovery(e: WildlifeEntity, cache: WorldChunkCache, dt: number): void {
  e.chargeRecoverTimer = Math.max(0, e.chargeRecoverTimer - dt);
  e.aiState = ST_IDLE;
  if (e.chargeRecoverTimer <= 0.85) return;
  const scale = 0.45 * ((e.chargeRecoverTimer - 0.85) / 0.3);
  const res = resolveMovement({
    cache, x: e.x, y: e.y, dx: e.chargeVx * scale * dt, dy: e.chargeVy * scale * dt,
    radius: 0.3, elevation: e.elevation, airborne: false,
  });
  e.x = res.x;
  e.y = res.y;
  e.elevation = res.elevation;
}

function resolveBoarCooldownSteer(e: WildlifeEntity, offset: { readonly dx: number; readonly dy: number; readonly dist: number }): BoarAction {
  if (e.attackCooldown > 0 && offset.dist < 1.8) {
    return { mode: "steer", steer: { x: e.x, y: e.y, speedMult: 0 } };
  }
  return { mode: "steer", steer: { x: e.x + offset.dx, y: e.y + offset.dy, speedMult: 1.0 } };
}

function resolveBoarMoveOrCharge(e: WildlifeEntity, target: CombatPlayerCandidate, events: WorldEvent[]): BoarAction {
  const dx = target.x - e.x;
  const dy = target.y - e.y;
  const dist = Math.hypot(dx, dy);
  if (e.telegraphTimer > 0 || dist <= 1.55) return { mode: "melee" };
  if (e.attackCooldown <= 0 && dist >= 1.9 && dist <= 10.0) {
    e.telegraphTimer = AI_TUNING.boarWindupSec;
    e.windupDuration = AI_TUNING.boarWindupSec;
    e.aiState = ST_CHARGE;
    events.push({ kind: "telegraph", x: e.x, y: e.y, actorId: e.id, entityKind: e.kind });
    return { mode: "done" };
  }
  return resolveBoarCooldownSteer(e, { dx, dy, dist });
}

export function stepBoarBehavior(opts: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity;
  readonly target: CombatPlayerCandidate; readonly dt: number; readonly onStrike: StrikePlayerFn;
  readonly events: WorldEvent[];
}): BoarAction {
  const { cache, e, target, dt, events } = opts;
  if (e.chargeTimer > 0) { advanceActiveBoarCharge(opts); return { mode: "done" }; }
  if (e.chargeRecoverTimer > 0) { advanceBoarRecovery(e, cache, dt); return { mode: "done" }; }
  if (e.telegraphTimer > 0 && e.aiState === ST_CHARGE) {
    faceTarget(e, target);
    e.telegraphTimer = Math.max(0, e.telegraphTimer - dt);
    if (e.telegraphTimer === 0) beginBoarCharge(e, target, events);
    return { mode: "done" };
  }
  return resolveBoarMoveOrCharge(e, target, events);
}

function isNightPhase(dayPhase: number): boolean {
  return dayPhase < 0.24 || dayPhase > 0.76;
}

export function hasSpiderCover(cache: WorldChunkCache, x: number, y: number): boolean {
  if (cache.tileAt(x, y).ground === GroundKind.ForestFloor) return true;
  return cache.propsNear(x, y).some((p) => SPIDER_COVER_PROPS.has(p.kind) && Math.hypot(p.x - x, p.y - y) <= 1.8);
}

export function isSpiderConcealed(opts: {
  readonly cache: WorldChunkCache; readonly x: number; readonly y: number; readonly dayPhase: number;
}): boolean {
  return isNightPhase(opts.dayPhase) || hasSpiderCover(opts.cache, opts.x, opts.y);
}

export function stepSpiderAmbushCheck(opts: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly target: CombatPlayerCandidate | null; readonly dayPhase: number;
}): boolean {
  if (opts.e.hitTimer > 0 || opts.e.alertedTimer > 0) return true;
  const concealed = isSpiderConcealed({ cache: opts.cache, x: opts.e.x, y: opts.e.y, dayPhase: opts.dayPhase });
  if (!opts.target) { opts.e.aiState = concealed ? ST_AMBUSH : ST_PATROL; return false; }
  if (!concealed) return true;
  const triggerDist = isNightPhase(opts.dayPhase) ? AI_TUNING.spiderAmbushNightTiles : AI_TUNING.spiderAmbushDayTiles;
  if (Math.hypot(opts.target.x - opts.e.x, opts.target.y - opts.e.y) <= triggerDist) return true;
  opts.e.aiState = ST_AMBUSH;
  return false;
}

function pickPatrolWaypoint(cache: WorldChunkCache, e: WildlifeEntity, timeSec: number): void {
  const seed = Math.floor(timeSec * 10) + e.packSlot * 31;
  const span = Math.min(3.2, e.homeRadius * 0.55);
  let gx = e.homeX;
  let gy = e.homeY;
  for (let attempt = 0; attempt < 6; attempt++) {
    const s = seed + attempt * 19;
    const ang = hashUnit2d(s, Math.floor(e.homeX), Math.floor(e.homeY)) * Math.PI * 2;
    const r = (0.35 + hashUnit2d(s + 17, Math.floor(e.homeY), Math.floor(e.homeX)) * 0.65) * span;
    const cand = { x: e.homeX + Math.cos(ang) * r, y: e.homeY + Math.sin(ang) * r };
    if (isClearSpot(cache, { ...cand, pad: 0.4 })) {
      gx = cand.x;
      gy = cand.y;
      break;
    }
  }
  e.patrolGoalX = gx;
  e.patrolGoalY = gy;
  e.patrolMoveTimer = 2.6 + hashUnit2d(seed + 41, e.packSlot, Math.floor(timeSec)) * 1.4;
}

function beginIdlePause(e: WildlifeEntity, timeSec: number): void {
  const r = hashUnit2d(Math.floor(timeSec * 10), e.packSlot + 17, Math.floor(e.homeX + e.homeY));
  e.patrolPauseTimer = 2.2 + r * 2.8;
  e.aiState = ST_IDLE;
}

function isStaticIdleEntity(cache: WorldChunkCache, e: WildlifeEntity, dayPhase: number | undefined): AiState | null {
  if (CREATURE_SPECS[e.kind].sentryIdle) return ST_IDLE;
  if (e.kind === "spider" && dayPhase !== undefined && isSpiderConcealed({ cache, x: e.x, y: e.y, dayPhase })) {
    return ST_AMBUSH;
  }
  return null;
}

export function stepHomePatrol(opts: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly timeSec: number; readonly dt: number; readonly dayPhase?: number;
}): void {
  const { cache, e, timeSec, dt, dayPhase } = opts;
  const hold = isStaticIdleEntity(cache, e, dayPhase);
  if (hold) { e.aiState = hold; return; }
  if (e.patrolPauseTimer > 0) {
    e.patrolPauseTimer = Math.max(0, e.patrolPauseTimer - dt);
    e.aiState = ST_IDLE;
    if (e.patrolPauseTimer === 0) pickPatrolWaypoint(cache, e, timeSec);
    return;
  }
  e.patrolMoveTimer = Math.max(0, e.patrolMoveTimer - dt);
  if (Math.hypot(e.patrolGoalX - e.x, e.patrolGoalY - e.y) <= 0.35 || e.patrolMoveTimer === 0) {
    beginIdlePause(e, timeSec);
    return;
  }
  e.aiState = ST_PATROL;
  moveCreatureToward({ cache, e, tx: e.patrolGoalX, ty: e.patrolGoalY, speed: CREATURE_SPECS[e.kind].speed * 0.42, dt });
}

export function isScavengeLootId(itemId: string): boolean {
  return itemId === ITEM_RAW_MEAT;
}
