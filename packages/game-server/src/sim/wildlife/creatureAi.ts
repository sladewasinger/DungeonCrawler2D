/** Shared wildlife perception, sanctuary leash, locked windups, multi-faction targeting, and combat loop. */
import { AI_TUNING, STEALTH_TUNING, WorldChunkCache, canReachMeleeTarget, type WorldEvent } from "@dc2d/engine";
import type { CombatPlayerRef } from "../combatActions.js";
import { stepBurnTarget } from "../combat/statusEffects.js";
import { holdsSpiderConcealedAmbush, stepSpiderPursuitActions } from "../webs/webCocoon.js";
import { CREATURE_SPECS, ST_ALERT, ST_AMBUSH, ST_CHARGE, ST_CHASE, ST_DEAD, ST_IDLE, ST_INVESTIGATE, ST_PATROL, ST_RETURN, type WildlifeEntity } from "./creatureSpecs.js";
import { clearNavPath, faceTarget, findReturnReaggroPlayer, stepIdleJumpArc, stepKnockbackVelocity, syncCreatureWaterState } from "./creatureNavigation.js";
import { computeSeparation, computeSlimeCohesion, isSpiderConcealed, moveCreatureToward, stepBearBluff, stepBearScavenge, stepBoarBehavior, stepBoarCommittedCharge, stepHomePatrol, type CombatPlayerCandidate, type EcologyFoodSource } from "./creatureBehaviors.js";
import { beginCreatureStrike, stepCreatureStrikeWindow, steerGoblinAllyRetreat } from "./ecologyHelpers.js";
import { decayUnseenSuspicion, findBestHostileTarget, isCreatureAggro, resolveLockedTarget, scanAlliesAndCorpses, stepSuspicionForTarget, type CombatTarget } from "./factionTargeting.js";
import { recordTargetPursuitState, redirectSearchByHearing, resetHuntTracking, stepLostSightGrace } from "./tracking/pursuitLoss.js";
import { stepStructuredInvestigation, tryHungryPassiveScentWhiff } from "./tracking/searchTracking.js";
import { rallyWolfPack, stepWolfHiveMind, triggerWolfSpotHowl } from "./wolfPackAi.js";
import type { ScentTrail } from "./scentTrail.js";

export type StrikeTargetFn = (entity: WildlifeEntity, target: CombatTarget) => void;

export interface StepCreatureInput {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly allEntities: readonly WildlifeEntity[];
  readonly players: readonly CombatPlayerCandidate[]; readonly foods: readonly EcologyFoodSource[];
  readonly onConsumeFood?: (food: EcologyFoodSource) => void; readonly scent: ScentTrail; readonly events: WorldEvent[];
  readonly timeSec: number; readonly dayPhase: number; readonly dt: number; readonly onStrike: StrikeTargetFn;
  readonly onBurnKill?: (e: WildlifeEntity) => void; readonly spawnWeb?: ((spider: WildlifeEntity, target: CombatTarget) => void) | undefined;
}

function decayTimers(e: WildlifeEntity, dt: number): void {
  e.hitTimer = Math.max(0, e.hitTimer - dt); e.staggerTimer = Math.max(0, e.staggerTimer - dt);
  if (e.staggerTimer === 0) e.parried = false;
  e.stunnedTimer = Math.max(0, e.stunnedTimer - dt); e.bleedTimer = Math.max(0, e.bleedTimer - dt);
  e.attackCooldown = Math.max(0, e.attackCooldown - dt); e.alertedTimer = Math.max(0, e.alertedTimer - dt);
  e.navTimer = Math.max(0, e.navTimer - dt); e.provokedTimer = Math.max(0, e.provokedTimer - dt);
  e.vocalCooldown = Math.max(0, e.vocalCooldown - dt); e.spottedPopTimer = Math.max(0, e.spottedPopTimer - dt);
  e.peelTimer = Math.max(0, e.peelTimer - dt); e.bluffCooldown = Math.max(0, e.bluffCooldown - dt);
  e.goblinRetreatTimer = Math.max(0, e.goblinRetreatTimer - dt);
  e.webShotCooldown = Math.max(0, e.webShotCooldown - dt);
  e.scentTrackTimer = Math.max(0, e.scentTrackTimer - dt);
  e.passiveSniffCooldown = Math.max(0, e.passiveSniffCooldown - dt);
  if (e.targetPlayerId === null) e.losGraceTimer = Math.max(0, e.losGraceTimer - dt);
}

function finishWindupStrike(input: StepCreatureInput): void {
  const { cache, e, players, allEntities, events, dt, onStrike } = input;
  e.telegraphTimer = Math.max(0, e.telegraphTimer - dt);
  if (e.telegraphTimer > 0) return;
  beginCreatureStrike({ cache, e, players, allEntities, events, onStrike });
}

function stepMeleeAttack(input: StepCreatureInput, target: CombatTarget): boolean {
  const { cache, e, events } = input;
  if (e.telegraphTimer > 0) { finishWindupStrike(input); return true; }
  if (e.strikeTimer > 0) return true;
  const spec = CREATURE_SPECS[e.kind];
  if (e.attackCooldown > 0 || Math.hypot(target.x - e.x, target.y - e.y) > spec.range || !canReachMeleeTarget(cache, e, target)) return false;
  faceTarget(e, target); e.aiState = ST_CHASE;
  e.telegraphTimer = spec.windupSec; e.windupDuration = spec.windupSec;
  events.push({ kind: "telegraph", x: e.x, y: e.y, actorId: e.id, entityKind: e.kind });
  return true;
}

function stepInvestigateOrPatrol(input: StepCreatureInput): void {
  const { cache, e, scent, timeSec, dayPhase, dt } = input;
  if (e.kind === "wolf" && e.hp < e.maxHp * 0.25) { enterReturnState(e); return; }
  if (e.investigateTimer <= 0) {
    e.targetPlayerId = null; e.targetKind = null; resetHuntTracking(e);
    if (!tryHungryPassiveScentWhiff({ cache, e, scent, dt })) stepHomePatrol({ cache, e, timeSec, dt, dayPhase });
    return;
  }
  if (CREATURE_SPECS[e.kind].territorialGuard && Math.hypot(e.lastKnownX - e.homeX, e.lastKnownY - e.homeY) > e.homeRadius * 1.45) {
    enterReturnState(e); return;
  }
  e.investigateTimer = Math.max(0, e.investigateTimer - dt); e.aiState = ST_INVESTIGATE;
  stepStructuredInvestigation({ cache, e, scent, dt });
}

function combineSepCohesion(e: WildlifeEntity, entities: readonly WildlifeEntity[]) {
  const s = computeSeparation(e, entities);
  const c = computeSlimeCohesion(e, entities);
  return { x: s.x + c.x, y: s.y + c.y };
}

function stepBoarEngage(input: StepCreatureInput, target: CombatTarget): void {
  const { cache, e, allEntities, events, dt, onStrike } = input;
  const sep = computeSeparation(e, allEntities);
  const boar = stepBoarBehavior({ cache, e, target, dt, onStrike: (ent, tgt) => onStrike(ent, tgt as CombatTarget), events });
  if (boar.mode === "done") return;
  if (boar.mode === "melee") {
    if (!stepMeleeAttack(input, target)) {
      moveCreatureToward({ cache, e, tx: target.x, ty: target.y, speed: CREATURE_SPECS.boar.speed, dt, stopRadius: 1.0, sep });
    }
    return;
  }
  e.aiState = ST_CHASE;
  moveCreatureToward({ cache, e, tx: boar.steer.x, ty: boar.steer.y, speed: CREATURE_SPECS.boar.speed * boar.steer.speedMult, dt, stopRadius: 1.0, sep });
}

function steerOrChargeTarget(input: StepCreatureInput, target: CombatTarget): void {
  const { cache, e, allEntities, timeSec, dt } = input;
  if (e.kind === "boar") { stepBoarEngage(input, target); return; }
  const goblinSteer = steerGoblinAllyRetreat(e, target, allEntities);
  if (goblinSteer) { moveCreatureToward({ cache, e, tx: goblinSteer.x, ty: goblinSteer.y, speed: CREATURE_SPECS.goblin.speed * goblinSteer.speedMult, dt }); return; }
  if (stepMeleeAttack(input, target)) return;
  const spec = CREATURE_SPECS[e.kind];
  const steer = e.kind === "wolf" ? stepWolfHiveMind({ cache, e, target, entities: allEntities, timeSec }) : (e.aiState = ST_CHASE, { x: target.x, y: target.y, speedMult: 1.0 });
  const stopRadius = e.kind === "wolf" && e.aiState === "flank" ? 0.16 : Math.max(0.75, spec.range * 0.68);
  moveCreatureToward({ cache, e, tx: steer.x, ty: steer.y, speed: spec.speed * steer.speedMult, dt, stopRadius, sep: combineSepCohesion(e, allEntities) });
}

function enterReturnState(e: WildlifeEntity): void {
  e.aiState = ST_RETURN; e.investigateTimer = 0; e.telegraphTimer = 0;
  e.strikeTimer = 0; e.strikeHitIds.clear(); e.chargeTimer = 0; e.bluffTimer = 0;
  e.suspicion = 0; e.unreachableTimer = 0; e.provokedTimer = 0;
  e.targetPlayerId = null; e.targetKind = null; e.spottedPopTimer = 0;
  resetHuntTracking(e);
  clearNavPath(e);
}

function finishHomeArrival(opts: { readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly dayPhase: number }): void {
  const { cache, e, dayPhase } = opts;
  const ambush = e.kind === "spider" && isSpiderConcealed({ cache, x: e.x, y: e.y, dayPhase });
  e.aiState = CREATURE_SPECS[e.kind].sentryIdle ? ST_IDLE : (ambush ? ST_AMBUSH : ST_PATROL);
  e.howlDone = false;
  if (ambush) e.pounceUsed = false;
  e.unreachableTimer = 0;
  clearNavPath(e);
}

function stepCommittedReturn(input: StepCreatureInput): void {
  const { cache, e, players, dayPhase, dt } = input;
  const reTarget = findReturnReaggroPlayer({ cache, e, players });
  if (reTarget) {
    e.aiState = ST_CHASE; e.targetPlayerId = reTarget.id;
    e.targetKind = "player"; e.suspicion = 1.0;
    e.provokedTimer = 4.0;
    e.spottedPopTimer = STEALTH_TUNING.spottedPopDurationSec;
    clearNavPath(e); pursueKnownTarget(input, { ...reTarget, targetKind: "player" }); return;
  }
  e.aiState = ST_RETURN;
  if (Math.hypot(e.homeX - e.x, e.homeY - e.y) <= 1.25) { finishHomeArrival({ cache, e, dayPhase }); return; }
  moveCreatureToward({ cache, e, tx: e.homeX, ty: e.homeY, speed: CREATURE_SPECS[e.kind].speed * 0.72, dt, stopRadius: 0.4 });
}

function isOutsideLeash(e: WildlifeEntity, target: CombatTarget): boolean {
  const spec = CREATURE_SPECS[e.kind];
  if (!spec.territorialGuard) return Math.hypot(target.x - e.x, target.y - e.y) > spec.visionRange * 1.55;
  const mult = e.provokedTimer > 0 ? 2.15 : 1.45;
  return Math.hypot(target.x - e.homeX, target.y - e.homeY) > e.homeRadius * mult || Math.hypot(e.x - e.homeX, e.y - e.homeY) > e.homeRadius * (mult + 0.15);
}

function checkUnreachableGlare(e: WildlifeEntity, dt: number): boolean {
  if (e.navReachedGoal) { e.unreachableTimer = 0; return false; }
  const wp = e.navPath[0];
  const atLedge = !wp || Math.hypot(wp.x - e.x, wp.y - e.y) <= 0.75;
  e.unreachableTimer += atLedge ? dt : dt * 0.35;
  if (e.unreachableTimer >= 2.5) { enterReturnState(e); return true; }
  return false;
}

function triggerSpottedTransition(input: StepCreatureInput, target: CombatTarget): void {
  const { e, allEntities, events } = input;
  if (e.targetPlayerId === target.id) return;
  const respot = e.huntedTargetId !== target.id || e.investigateElapsed >= 0.9;
  e.targetPlayerId = target.id; e.targetKind = target.targetKind;
  e.suspicion = 1.0; e.scentTrackTimer = 0; e.investigateElapsed = 0;
  if (respot) e.spottedPopTimer = STEALTH_TUNING.spottedPopDurationSec;
  if (triggerWolfSpotHowl({ e, entities: allEntities, events })) return;
  if (respot && e.vocalCooldown <= 0) {
    e.vocalCooldown = 3.5;
    events.push({ kind: "creatureVocal", x: e.x, y: e.y, actorId: e.id, entityKind: e.kind, vocalKind: "alert" });
  }
}

function dispatchPursuitBehavior(input: StepCreatureInput, target: CombatTarget): void {
  const { cache, e, players, dayPhase, dt, events, spawnWeb } = input;
  e.losGraceTimer = AI_TUNING.losGraceSec;
  recordTargetPursuitState(e, target, dt);
  if (stepSpiderPursuitActions({ cache, spider: e, target, players: players as readonly CombatPlayerRef[], dayPhase, dt, events, spawnWeb })) return;
  steerOrChargeTarget(input, target);
  const wolfRetreated = e.kind === "wolf" && e.aiState === ST_RETURN && Math.hypot(target.x - e.x, target.y - e.y) >= 8.5;
  if (wolfRetreated) enterReturnState(e); else checkUnreachableGlare(e, dt);
}

function pursueKnownTarget(input: StepCreatureInput, target: CombatTarget): void {
  const { e, events, dt } = input;
  if (isOutsideLeash(e, target)) { enterReturnState(e); return; }
  const bluff = stepBearBluff({ e, target, events, dt });
  if (bluff === "calm") { enterReturnState(e); return; }
  if (bluff === "bluffing") {
    e.targetPlayerId = target.id; e.targetKind = target.targetKind;
    e.lastKnownX = target.x; e.lastKnownY = target.y;
    return;
  }
  triggerSpottedTransition(input, target);
  if (e.howlTimer <= 0) dispatchPursuitBehavior(input, target);
}

function stepHowlHold(input: StepCreatureInput): boolean {
  const { e, allEntities, events, dt } = input;
  if (e.howlTimer <= 0) return false;
  e.howlTimer = Math.max(0, e.howlTimer - dt); e.aiState = ST_ALERT;
  if (e.howlTimer === 0) rallyWolfPack({ source: e, entities: allEntities, events });
  return true;
}

function stepScavengeHold(input: StepCreatureInput): boolean {
  const { cache, e, foods, onConsumeFood, dt } = input;
  const spec = CREATURE_SPECS[e.kind];
  if (!spec.scavenger || isCreatureAggro(e) || e.hitTimer > 0 || e.alertedTimer > 0 || e.provokedTimer > 0) return false;
  const forage = stepBearScavenge({ e, foods, dt, ...(onConsumeFood ? { onConsume: onConsumeFood } : {}) });
  if (!forage) return false;
  moveCreatureToward({ cache, e, tx: forage.x, ty: forage.y, speed: spec.speed * forage.speedMult, dt });
  return true;
}

function stepChargeOrForage(input: StepCreatureInput): boolean {
  const { cache, e, allEntities, players, events, dt, onStrike } = input;
  if (stepHowlHold(input)) return true;
  const chargeTarget = e.targetPlayerId ? resolveLockedTarget({ id: e.targetPlayerId, players, allEntities }) : null;
  if (stepBoarCommittedCharge({ cache, e, target: chargeTarget, dt, onStrike: (ent, t) => onStrike(ent, t as CombatTarget), events })) return true;
  return stepScavengeHold(input);
}

function handleUnseenTurn(input: StepCreatureInput): void {
  const unseen = { cache: input.cache, e: input.e, allEntities: input.allEntities, players: input.players, dt: input.dt, enterReturn: enterReturnState };
  if (stepLostSightGrace(unseen)) return;
  redirectSearchByHearing(unseen);
  decayUnseenSuspicion(input.e, input.dt); input.e.bluffTimer = 0;
  stepInvestigateOrPatrol(input);
}

function stepCommittedMeleeWindup(input: StepCreatureInput): boolean {
  const { e } = input;
  if (e.telegraphTimer <= 0 || (e.kind === "boar" && e.aiState === ST_CHARGE)) return false;
  const locked = e.targetPlayerId ? resolveLockedTarget({ id: e.targetPlayerId, players: input.players, allEntities: input.allEntities }) : null;
  if (!locked) { e.telegraphTimer = 0; return false; }
  finishWindupStrike(input); return true;
}

function stepActiveWildlifeTurn(input: StepCreatureInput): void {
  const { cache, e, allEntities, players, dayPhase, dt } = input;
  stepCreatureStrikeWindow({ cache, e, players, allEntities, dt, onStrike: input.onStrike });
  if (e.aiState === ST_RETURN) { e.telegraphTimer = 0; stepCommittedReturn(input); return; }
  if (stepChargeOrForage(input)) return;
  if (stepCommittedMeleeWindup(input)) return;
  scanAlliesAndCorpses({ cache, e, allEntities, players });
  const perceived = findBestHostileTarget({ cache, e, players, allEntities });
  if (!perceived) { handleUnseenTurn(input); return; }
  if (holdsSpiderConcealedAmbush({ cache, e, perceived, dayPhase })) return;
  if (stepSuspicionForTarget({ e, perceived, dt }) === "engage") pursueKnownTarget(input, perceived);
  else stepInvestigateOrPatrol(input);
}

export function stepWildlifeEntity(input: StepCreatureInput): boolean {
  const { e, dt } = input;
  e.jumpStepped = false;
  if (e.hp <= 0 || e.corpse) {
    e.aiState = ST_DEAD; e.telegraphTimer = 0; e.strikeTimer = 0;
    e.spottedPopTimer = 0; e.howlTimer = 0; e.bluffTimer = 0;
    e.corpseTimer = Math.max(0, e.corpseTimer - dt);
    return e.corpseTimer > 0;
  }
  decayTimers(e, dt);
  syncCreatureWaterState(input.cache, e);
  stepBurnTarget({ target: e, dt, kind: e.kind, x: e.x, y: e.y, targetId: e.id, events: input.events, onTickDamage: (dmg) => { e.hp = Math.max(0, e.hp - dmg); if (e.hp <= 0) input.onBurnKill?.(e); } });
  if (e.hp <= 0 || e.corpse) return true;
  stepKnockbackVelocity(input.cache, e, dt);
  if (e.staggerTimer > 0) {
    e.telegraphTimer = 0; e.strikeTimer = 0; e.bluffTimer = 0;
    stepIdleJumpArc(e, dt); return true;
  }
  stepActiveWildlifeTurn(input);
  stepIdleJumpArc(e, dt);
  return true;
}
