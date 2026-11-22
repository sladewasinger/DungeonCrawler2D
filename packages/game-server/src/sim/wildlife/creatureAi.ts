/** Shared wildlife perception, sanctuary leash, investigation, and attack loop. */
import { AI_TUNING, WorldChunkCache, canPerceiveTarget, isInSanctuary, type WorldEvent } from "@dc2d/engine";
import { CREATURE_SPECS, ST_ALERT, ST_CHASE, ST_DEAD, ST_INVESTIGATE, type WildlifeEntity } from "./creatureSpecs.js";
import {
  moveCreatureToward, stepBearScavenge, stepBoarBehavior, stepHomePatrol,
  stepSpiderAmbushCheck, stepWolfPack, type CombatPlayerCandidate, type EcologyFoodSource, type StrikePlayerFn,
} from "./creatureBehaviors.js";
import type { ScentTrail } from "./scentTrail.js";

export interface StepCreatureInput {
  readonly cache: WorldChunkCache;
  readonly e: WildlifeEntity;
  readonly allEntities: readonly WildlifeEntity[];
  readonly players: readonly CombatPlayerCandidate[];
  readonly foods: readonly EcologyFoodSource[];
  readonly scent: ScentTrail;
  readonly events: WorldEvent[];
  readonly timeSec: number;
  readonly dayPhase: number;
  readonly dt: number;
  readonly onStrike: StrikePlayerFn;
}

function decayTimers(e: WildlifeEntity, dt: number): void {
  e.hitTimer = Math.max(0, e.hitTimer - dt);
  e.staggerTimer = Math.max(0, e.staggerTimer - dt);
  e.bleedTimer = Math.max(0, e.bleedTimer - dt);
  e.attackCooldown = Math.max(0, e.attackCooldown - dt);
  e.alertedTimer = Math.max(0, e.alertedTimer - dt);
}

function canNoticePlayer(opts: { readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly p: CombatPlayerCandidate; readonly dist: number }): boolean {
  const spec = CREATURE_SPECS[opts.e.kind];
  if (opts.e.alertedTimer > 0 && opts.dist <= spec.visionRange * 1.25) return true;
  return canPerceiveTarget({
    cache: opts.cache, observer: opts.e, target: opts.p,
    visionRange: spec.visionRange, halfConeRad: AI_TUNING.halfConeRad, hearRange: spec.hearRange,
  });
}

function findPerceivedTarget(cache: WorldChunkCache, e: WildlifeEntity, players: readonly CombatPlayerCandidate[]): CombatPlayerCandidate | null {
  let best: CombatPlayerCandidate | null = null;
  let bestDist = Infinity;
  for (const p of players) {
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    if (d < bestDist && !isInSanctuary(p.x, p.y) && canNoticePlayer({ cache, e, p, dist: d })) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

function finishWindupStrike(opts: {
  readonly e: WildlifeEntity; readonly target: CombatPlayerCandidate; readonly events: WorldEvent[];
  readonly dt: number; readonly onStrike: StrikePlayerFn;
}): void {
  const { e, target, events, dt, onStrike } = opts;
  const spec = CREATURE_SPECS[e.kind];
  e.telegraphTimer = Math.max(0, e.telegraphTimer - dt);
  if (e.telegraphTimer > 0) return;
  e.attackCooldown = spec.cooldownSec;
  events.push({ kind: "swing", x: e.x, y: e.y, dirX: e.facingX, dirY: e.facingY, actorId: e.id });
  if (Math.hypot(target.x - e.x, target.y - e.y) <= spec.range + 0.35) onStrike(e, target);
}

function stepMeleeAttack(opts: {
  readonly e: WildlifeEntity; readonly target: CombatPlayerCandidate; readonly events: WorldEvent[];
  readonly dt: number; readonly onStrike: StrikePlayerFn;
}): boolean {
  const { e, target, events, dt, onStrike } = opts;
  if (e.telegraphTimer > 0) { finishWindupStrike({ e, target, events, dt, onStrike }); return true; }
  const spec = CREATURE_SPECS[e.kind];
  if (e.attackCooldown <= 0 && Math.hypot(target.x - e.x, target.y - e.y) <= spec.range) {
    e.telegraphTimer = spec.windupSec;
    e.windupDuration = spec.windupSec;
    events.push({ kind: "telegraph", x: e.x, y: e.y, actorId: e.id });
    return true;
  }
  return false;
}

function stepInvestigateOrPatrol(input: StepCreatureInput): void {
  const { cache, e, scent, timeSec, dt } = input;
  const spec = CREATURE_SPECS[e.kind];
  if (e.investigateTimer <= 0) { stepHomePatrol({ cache, e, timeSec, dt }); return; }
  e.investigateTimer = Math.max(0, e.investigateTimer - dt);
  e.aiState = ST_INVESTIGATE;
  const dist = Math.hypot(e.lastKnownX - e.x, e.lastKnownY - e.y);
  if (dist >= 0.75) {
    moveCreatureToward({ cache, e, tx: e.lastKnownX, ty: e.lastKnownY, speed: spec.speed * 0.78, dt });
    return;
  }
  const crumb = scent.findStrongestNear(e.x, e.y, AI_TUNING.scentRadiusTiles);
  if (crumb) { e.lastKnownX = crumb.x; e.lastKnownY = crumb.y; return; }
  const px = e.lastKnownX - e.facingY * e.peekSide * 1.4;
  const py = e.lastKnownY + e.facingX * e.peekSide * 1.4;
  moveCreatureToward({ cache, e, tx: px, ty: py, speed: spec.speed * 0.55, dt });
}

function pickSteerTarget(input: StepCreatureInput, target: CombatPlayerCandidate) {
  const { e, allEntities, timeSec, onStrike } = input;
  if (e.kind === "wolf") return stepWolfPack({ e, target, entities: allEntities, timeSec, onStrike });
  e.aiState = e.alertedTimer > 0 ? ST_ALERT : ST_CHASE;
  return { x: target.x, y: target.y, speedMult: 1.0 };
}

function steerOrChargeTarget(input: StepCreatureInput, target: CombatPlayerCandidate): void {
  const { cache, e, events, dt, onStrike } = input;
  const spec = CREATURE_SPECS[e.kind];
  if (e.kind === "boar") {
    const boarSteer = stepBoarBehavior({ cache, e, target, dt, onStrike });
    if (boarSteer) moveCreatureToward({ cache, e, tx: boarSteer.x, ty: boarSteer.y, speed: spec.speed * boarSteer.speedMult, dt });
    return;
  }
  if (stepMeleeAttack({ e, target, events, dt, onStrike })) return;
  const steer = pickSteerTarget(input, target);
  moveCreatureToward({ cache, e, tx: steer.x, ty: steer.y, speed: spec.speed * steer.speedMult, dt });
}

function pursueKnownTarget(input: StepCreatureInput, target: CombatPlayerCandidate): void {
  const { cache, e, timeSec, dayPhase, dt } = input;
  e.lastKnownX = target.x;
  e.lastKnownY = target.y;
  e.investigateTimer = AI_TUNING.investigateDurationSec;
  if (Math.hypot(target.x - e.homeX, target.y - e.homeY) > e.homeRadius * 1.45) {
    stepHomePatrol({ cache, e, timeSec, dt });
    return;
  }
  if (e.kind === "spider" && !stepSpiderAmbushCheck({ e, target, dayPhase })) return;
  steerOrChargeTarget(input, target);
}

function tryScavengeTurn(input: StepCreatureInput): boolean {
  const { cache, e, foods, dt } = input;
  const spec = CREATURE_SPECS[e.kind];
  if (!spec.scavenger || e.hitTimer > 0 || e.alertedTimer > 0) return false;
  const forage = stepBearScavenge({ e, foods, dt });
  if (!forage) return false;
  moveCreatureToward({ cache, e, tx: forage.x, ty: forage.y, speed: spec.speed * forage.speedMult, dt });
  return true;
}

export function stepWildlifeEntity(input: StepCreatureInput): boolean {
  const { cache, e, players, dt } = input;
  if (e.hp <= 0 || e.corpse) {
    e.aiState = ST_DEAD;
    e.telegraphTimer = 0;
    e.corpseTimer = Math.max(0, e.corpseTimer - dt);
    return e.corpseTimer > 0;
  }
  decayTimers(e, dt);
  if (e.staggerTimer > 0) { e.telegraphTimer = 0; return true; }
  if (tryScavengeTurn(input)) return true;
  const target = findPerceivedTarget(cache, e, players);
  if (target) pursueKnownTarget(input, target);
  else stepInvestigateOrPatrol(input);
  return true;
}
