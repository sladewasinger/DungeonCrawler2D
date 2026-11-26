/** Specialized archetype steering, separation, boar wall-stun, bear bluff, spider pounce, and slime cohesion. */
import { AI_TUNING, GroundKind, PropKind, WorldChunkCache, attackHitboxHitsHurtbox, buildEntityAttackHitbox, canReachMeleeTarget, entityHurtbox, hasClearChargeLane, hashUnit2d, isInSanctuary, playerHurtbox, resolveMovement, type AiState, type WorldEvent } from "@dc2d/engine";
import { CREATURE_SPECS, ITEM_RAW_MEAT, ST_ALERT, ST_AMBUSH, ST_CHARGE, ST_FEED, ST_IDLE, ST_PATROL, type WildlifeEntity } from "./creatureSpecs.js";
import { applyEntityMoveResult, creatureWaterSpeedMult, faceTarget, isClearSpot, moveCreatureToward } from "./creatureNavigation.js";
import type { CombatTarget } from "./factionTargeting.js";

const SPIDER_COVER_PROPS = new Set<PropKind>([PropKind.TallGrass, PropKind.Bush, PropKind.OakTree, PropKind.PineTree]);

export { moveCreatureToward };

export interface SteerTarget { readonly x: number; readonly y: number; readonly speedMult: number }
export interface CombatPlayerCandidate {
  readonly id: string; readonly x: number; readonly y: number; readonly elevation: number; readonly moving: boolean;
  readonly facingX?: number | undefined; readonly facingY?: number | undefined; readonly crouching?: boolean | undefined;
  readonly visibility?: number | undefined; readonly noiseRadius?: number | undefined;
  readonly combat?: { readonly cocoonProgress?: number } | undefined;
}
export interface EcologyFoodSource { readonly x: number; readonly y: number; readonly isMeatLoot?: boolean; readonly lootId?: string; readonly entityId?: string; }
export type StrikePlayerFn = (entity: WildlifeEntity, target: CombatPlayerCandidate) => void;
export type BoarAction = { readonly mode: "done" } | { readonly mode: "melee" } | { readonly mode: "steer"; readonly steer: SteerTarget };

export function computeSeparation(e: WildlifeEntity, entities: readonly WildlifeEntity[]): { readonly x: number; readonly y: number } {
  let sx = 0; let sy = 0;
  for (const other of entities) {
    if (other.corpse || other.hp <= 0 || other.id === e.id) continue;
    const dx = e.x - other.x; const dy = e.y - other.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.01 && d < 0.95) { const push = (0.95 - d) / d; sx += dx * push; sy += dy * push; }
  }
  return { x: sx, y: sy };
}

function slimePullStep(e: WildlifeEntity, o: WildlifeEntity): { readonly x: number; readonly y: number } | null {
  if (o.corpse || o.hp <= 0 || o.kind !== "slime" || o.id === e.id) return null;
  const d = Math.hypot(o.x - e.x, o.y - e.y);
  if (d <= 1.35 || d >= 7.5) return null;
  return { x: (o.x - e.x) / d, y: (o.y - e.y) / d };
}

export function computeSlimeCohesion(e: WildlifeEntity, entities: readonly WildlifeEntity[]): { readonly x: number; readonly y: number } {
  if (e.kind !== "slime") return { x: 0, y: 0 };
  let cx = 0; let cy = 0;
  for (const o of entities) {
    const step = slimePullStep(e, o);
    if (!step) continue;
    cx += step.x; cy += step.y;
  }
  return { x: cx * 0.4, y: cy * 0.4 };
}

const shouldBearSkipBluff = (e: WildlifeEntity): boolean =>
  e.kind !== "bear" || e.hitTimer > 0 || e.alertedTimer > 0 || e.provokedTimer > 0 || (e.targetPlayerId !== null && e.bluffTimer <= 0);

export function stepBearBluff(opts: {
  readonly e: WildlifeEntity; readonly target: CombatPlayerCandidate; readonly events: WorldEvent[]; readonly dt: number;
}): "bluffing" | "calm" | "engage" {
  const { e, target, events, dt } = opts;
  if (shouldBearSkipBluff(e)) return "engage";
  const dist = Math.hypot(target.x - e.x, target.y - e.y);
  if (dist < 4.2) { e.bluffTimer = 0; return "engage"; }
  if (e.bluffTimer > 0) return continueBearBluff(e, target, { dist, dt });
  if (e.bluffCooldown > 0 || dist > 8.5) return "engage";
  e.bluffTimer = 1.25; e.bluffCooldown = 8.0; e.aiState = ST_ALERT;
  events.push({ kind: "bearBluff", x: e.x, y: e.y, actorId: e.id, entityKind: e.kind });
  return "bluffing";
}

function continueBearBluff(e: WildlifeEntity, target: CombatPlayerCandidate, info: { readonly dist: number; readonly dt: number }): "bluffing" | "calm" | "engage" {
  e.bluffTimer = Math.max(0, e.bluffTimer - info.dt);
  faceTarget(e, target); e.aiState = ST_ALERT;
  if (info.dist > 6.4) { e.bluffTimer = 0; e.bluffCooldown = 6.0; return "calm"; }
  return e.bluffTimer > 0 ? "bluffing" : "engage";
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
  readonly onConsume?: (food: EcologyFoodSource) => void;
}): SteerTarget | null {
  const { e, foods, dt, onConsume } = opts;
  e.hunger = Math.min(1, e.hunger + dt * 0.05);
  if (e.feedTimer > 0) { e.feedTimer = Math.max(0, e.feedTimer - dt); e.aiState = ST_FEED; return { x: e.x, y: e.y, speedMult: 0 }; }
  const hit = e.hunger >= 0.35 || foods.length > 0 ? findNearestFood(e, foods) : null;
  if (!hit) return null;
  e.aiState = ST_FEED;
  if (hit.dist <= 0.95) {
    e.feedTimer = AI_TUNING.bearFeedDurationSec; e.hunger = 0;
    e.hp = Math.min(e.maxHp, e.hp + Math.round(e.maxHp * 0.25));
    onConsume?.(hit.food);
    return { x: e.x, y: e.y, speedMult: 0 };
  }
  return { x: hit.food.x, y: hit.food.y, speedMult: 0.85 };
}

function beginBoarCharge(e: WildlifeEntity, events: WorldEvent[]): void {
  const mag = Math.max(0.01, Math.hypot(e.facingX, e.facingY));
  e.facingX /= mag; e.facingY /= mag;
  e.chargeVx = e.facingX * CREATURE_SPECS.boar.speed * AI_TUNING.boarChargeSpeedMult;
  e.chargeVy = e.facingY * CREATURE_SPECS.boar.speed * AI_TUNING.boarChargeSpeedMult;
  e.chargeTimer = AI_TUNING.boarChargeDurationSec; e.chargeHitDealt = false; e.aiState = ST_CHARGE;
  events.push({ kind: "creatureVocal", x: e.x, y: e.y, dirX: e.facingX, dirY: e.facingY, actorId: e.id, entityKind: e.kind, vocalKind: "charge" });
}

function stunBoarOnWall(e: WildlifeEntity, events: WorldEvent[]): void {
  const mag = Math.max(0.01, Math.hypot(e.chargeVx, e.chargeVy));
  e.kbVx = -(e.chargeVx / mag) * 2.6; e.kbVy = -(e.chargeVy / mag) * 2.6;
  e.stunnedTimer = 1.5; e.staggerTimer = 1.5; e.chargeTimer = 0; e.chargeRecoverTimer = 0.25;
  e.aiState = ST_IDLE; e.attackCooldown = 1.5 + CREATURE_SPECS.boar.cooldownSec;
  events.push({ kind: "boarCrash", x: e.x, y: e.y, actorId: e.id, entityKind: e.kind });
}

function tryBoarChargeHit(opts: { readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly target: CombatPlayerCandidate | null; readonly onStrike: StrikePlayerFn }): void {
  const { cache, e, target, onStrike } = opts;
  if (!target || e.chargeHitDealt) return;
  const entityTarget = (target as CombatTarget).targetKind === "entity" ? (target as CombatTarget).entityRef : undefined;
  const hurtbox = entityTarget ? entityHurtbox(target, entityTarget.kind, cache) : playerHurtbox(target, cache);
  if (!attackHitboxHitsHurtbox(buildEntityAttackHitbox(e, cache), hurtbox)) return;
  e.chargeHitDealt = true; onStrike(e, target);
}

function advanceActiveBoarCharge(opts: { readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly target: CombatPlayerCandidate | null; readonly dt: number; readonly onStrike: StrikePlayerFn; readonly events: WorldEvent[] }): void {
  const { cache, e, target, dt, onStrike, events } = opts;
  e.chargeTimer = Math.max(0, e.chargeTimer - dt); e.aiState = ST_CHARGE;
  const prevX = e.x; const prevY = e.y;
  const stepScale = creatureWaterSpeedMult(e) * dt;
  const intended = Math.hypot(e.chargeVx * stepScale, e.chargeVy * stepScale);
  const res = resolveMovement({ cache, x: e.x, y: e.y, dx: e.chargeVx * stepScale, dy: e.chargeVy * stepScale, radius: 0.28, elevation: e.elevation, airborne: false });
  applyEntityMoveResult(e, res);
  if (intended > 0.04 && Math.hypot(res.x - prevX, res.y - prevY) < intended * 0.35) { stunBoarOnWall(e, events); return; }
  tryBoarChargeHit({ cache, e, target, onStrike });
  if (e.chargeTimer === 0) { e.chargeRecoverTimer = 1.15; e.aiState = ST_IDLE; e.attackCooldown = CREATURE_SPECS.boar.cooldownSec; }
}

function advanceBoarRecovery(e: WildlifeEntity, cache: WorldChunkCache, dt: number): void {
  e.chargeRecoverTimer = Math.max(0, e.chargeRecoverTimer - dt); e.aiState = ST_IDLE;
  if (e.chargeRecoverTimer <= 0.85) return;
  const scale = 0.45 * ((e.chargeRecoverTimer - 0.85) / 0.3) * creatureWaterSpeedMult(e);
  const res = resolveMovement({ cache, x: e.x, y: e.y, dx: e.chargeVx * scale * dt, dy: e.chargeVy * scale * dt, radius: 0.28, elevation: e.elevation, airborne: false });
  applyEntityMoveResult(e, res);
}

function holdOrChaseBoarSteer(e: WildlifeEntity, target: CombatPlayerCandidate, dist: number): SteerTarget {
  if (e.attackCooldown > 0 && dist < 1.8) return { x: e.x, y: e.y, speedMult: 0 };
  return { x: target.x, y: target.y, speedMult: 1.0 };
}

function resolveBoarMoveOrCharge(opts: { readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly target: CombatPlayerCandidate; readonly events: WorldEvent[] }): BoarAction {
  const { cache, e, target, events } = opts;
  const dist = Math.hypot(target.x - e.x, target.y - e.y);
  if ((e.telegraphTimer > 0 || dist <= 1.55) && canReachMeleeTarget(cache, e, target)) return { mode: "melee" };
  if (e.attackCooldown <= 0 && dist >= 1.9 && dist <= 10.0 && hasClearChargeLane({ cache, from: e, to: target, radius: 0.3 })) {
    faceTarget(e, target); e.telegraphTimer = AI_TUNING.boarWindupSec; e.windupDuration = AI_TUNING.boarWindupSec; e.aiState = ST_CHARGE;
    events.push({ kind: "telegraph", x: e.x, y: e.y, actorId: e.id, entityKind: e.kind });
    return { mode: "done" };
  }
  return { mode: "steer", steer: holdOrChaseBoarSteer(e, target, dist) };
}

function stepBoarChargeWindupOrCancel(opts: Parameters<typeof stepBoarCommittedCharge>[0]): boolean {
  if (!opts.target) { opts.e.telegraphTimer = 0; opts.e.aiState = ST_IDLE; return false; }
  advanceBoarChargeWindup({ cache: opts.cache, e: opts.e, target: opts.target, dt: opts.dt, events: opts.events });
  return true;
}

export function stepBoarCommittedCharge(opts: { readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly target: CombatPlayerCandidate | null; readonly dt: number; readonly onStrike: StrikePlayerFn; readonly events: WorldEvent[] }): boolean {
  if (opts.e.kind !== "boar") return false;
  if (opts.e.chargeTimer > 0) { advanceActiveBoarCharge(opts); return true; }
  if (opts.e.chargeRecoverTimer > 0) { advanceBoarRecovery(opts.e, opts.cache, opts.dt); return true; }
  if (opts.e.telegraphTimer > 0 && opts.e.aiState === ST_CHARGE) return stepBoarChargeWindupOrCancel(opts);
  return false;
}

function advanceBoarChargeWindup(opts: { readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly target: CombatPlayerCandidate; readonly dt: number; readonly events: WorldEvent[] }): void {
  const { cache, e, target, dt, events } = opts;
  if (hasClearChargeLane({ cache, from: e, to: target, radius: 0.3 })) faceTarget(e, target);
  e.telegraphTimer = Math.max(0, e.telegraphTimer - dt);
  if (e.telegraphTimer === 0) beginBoarCharge(e, events);
}

export function stepBoarBehavior(opts: { readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly target: CombatPlayerCandidate; readonly dt: number; readonly onStrike: StrikePlayerFn; readonly events: WorldEvent[] }): BoarAction {
  const { cache, e, target, dt, events } = opts;
  if (stepBoarCommittedCharge(opts)) return { mode: "done" };
  if (e.telegraphTimer > 0 && e.aiState === ST_CHARGE) { advanceBoarChargeWindup({ cache, e, target, dt, events }); return { mode: "done" }; }
  return resolveBoarMoveOrCharge({ cache, e, target, events });
}

const isNightPhase = (dayPhase: number): boolean => dayPhase < 0.24 || dayPhase > 0.76;

export function hasSpiderCover(cache: WorldChunkCache, x: number, y: number): boolean {
  if (cache.tileAt(x, y).ground === GroundKind.ForestFloor) return true;
  return cache.propsNear(x, y).some((p) => SPIDER_COVER_PROPS.has(p.kind) && Math.hypot(p.x - x, p.y - y) <= 1.8);
}

export const isSpiderConcealed = (opts: { readonly cache: WorldChunkCache; readonly x: number; readonly y: number; readonly dayPhase: number }): boolean =>
  isNightPhase(opts.dayPhase) || hasSpiderCover(opts.cache, opts.x, opts.y);

function holdSpiderAmbush(e: WildlifeEntity): boolean { e.aiState = ST_AMBUSH; e.pounceUsed = false; return false; }

function stepIdleSpider(e: WildlifeEntity, concealed: boolean): boolean {
  if (concealed) return holdSpiderAmbush(e);
  e.aiState = ST_PATROL;
  return false;
}

function triggerSpiderPounce(e: WildlifeEntity, target: CombatPlayerCandidate): boolean {
  if (!e.pounceUsed && e.jumpZ <= 0.01) {
    const dx = target.x - e.x; const dy = target.y - e.y;
    const mag = Math.max(0.01, Math.hypot(dx, dy));
    e.kbVx = (dx / mag) * 8.2; e.kbVy = (dy / mag) * 8.2;
    e.jumpVz = 4.6;
    e.pounceUsed = true;
  }
  return true;
}

function spiderTriggerDist(dayPhase: number): number {
  return isNightPhase(dayPhase) ? AI_TUNING.spiderAmbushNightTiles : AI_TUNING.spiderAmbushDayTiles;
}

export function stepSpiderAmbushCheck(opts: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly target: CombatPlayerCandidate | null; readonly dayPhase: number;
}): boolean {
  const { e, target, cache, dayPhase } = opts;
  if (e.hitTimer > 0 || e.alertedTimer > 0) return true;
  const concealed = isSpiderConcealed({ cache, x: e.x, y: e.y, dayPhase });
  if (!target) return stepIdleSpider(e, concealed);
  if (!concealed) return true;
  if (Math.hypot(target.x - e.x, target.y - e.y) > spiderTriggerDist(dayPhase)) return holdSpiderAmbush(e);
  return triggerSpiderPounce(e, target);
}

function pickPatrolWaypoint(cache: WorldChunkCache, e: WildlifeEntity, timeSec: number): void {
  const seed = Math.floor(timeSec * 10) + e.packSlot * 31;
  const span = Math.min(3.2, e.homeRadius * 0.55);
  let gx = e.homeX; let gy = e.homeY;
  for (let attempt = 0; attempt < 6; attempt++) {
    const s = seed + attempt * 19;
    const ang = hashUnit2d(s, Math.floor(e.homeX), Math.floor(e.homeY)) * Math.PI * 2;
    const r = (0.35 + hashUnit2d(s + 17, Math.floor(e.homeY), Math.floor(e.homeX)) * 0.65) * span;
    const cand = { x: e.homeX + Math.cos(ang) * r, y: e.homeY + Math.sin(ang) * r };
    if (isClearSpot(cache, { ...cand, pad: 0.4 })) { gx = cand.x; gy = cand.y; break; }
  }
  e.patrolGoalX = gx; e.patrolGoalY = gy;
  e.patrolMoveTimer = 2.6 + hashUnit2d(seed + 41, e.packSlot, Math.floor(timeSec)) * 1.4;
}

function staticPatrolHoldState(cache: WorldChunkCache, e: WildlifeEntity, dayPhase?: number): AiState | null {
  if (CREATURE_SPECS[e.kind].sentryIdle) return ST_IDLE;
  if (e.kind !== "spider" || dayPhase === undefined) return null;
  return isSpiderConcealed({ cache, x: e.x, y: e.y, dayPhase }) ? ST_AMBUSH : null;
}

export function stepHomePatrol(opts: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly timeSec: number; readonly dt: number; readonly dayPhase?: number;
}): void {
  const { cache, e, timeSec, dt, dayPhase } = opts;
  const hold = staticPatrolHoldState(cache, e, dayPhase);
  if (hold) { e.aiState = hold; if (hold === ST_AMBUSH) e.pounceUsed = false; return; }
  if (e.patrolPauseTimer > 0) {
    e.patrolPauseTimer = Math.max(0, e.patrolPauseTimer - dt); e.aiState = ST_IDLE;
    if (e.patrolPauseTimer === 0) pickPatrolWaypoint(cache, e, timeSec);
    return;
  }
  e.patrolMoveTimer = Math.max(0, e.patrolMoveTimer - dt);
  if (Math.hypot(e.patrolGoalX - e.x, e.patrolGoalY - e.y) <= 0.35 || e.patrolMoveTimer === 0) {
    const r = hashUnit2d(Math.floor(timeSec * 10), e.packSlot + 17, Math.floor(e.homeX + e.homeY));
    e.patrolPauseTimer = 2.2 + r * 2.8; e.aiState = ST_IDLE; return;
  }
  e.aiState = ST_PATROL;
  moveCreatureToward({ cache, e, tx: e.patrolGoalX, ty: e.patrolGoalY, speed: CREATURE_SPECS[e.kind].speed * 0.42, dt });
}

export const isScavengeLootId = (itemId: string): boolean => itemId === ITEM_RAW_MEAT;