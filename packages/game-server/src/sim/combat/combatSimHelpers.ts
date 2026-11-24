/** Extracted combat movement multipliers, active swing pass dispatch, and input buffer helpers. */
import { getItemDef } from "@dc2d/content";
import {
  BOW_MAX_CHARGE_SEC, COMBAT_TUNING, MELEE_FEEL_TUNING, PARRY_STAGGER_SEC, STEALTH_TUNING, WorldChunkCache,
  evaluateBowShot, isInSanctuary, isSharpWeapon, playerFootSegment, resolveMovement, resolveWeaponArchetype,
  type GoreStyle, type WorldEvent,
} from "@dc2d/engine";
import { applyIncomingPlayerHit, resolveMeleeHits, type CombatPlayerRef } from "../combatActions.js";
import type { SimEntity } from "../dummySim.js";
import type { ResourceHarvester } from "../survival/resourceHarvester.js";
import type { WorldWebNetwork } from "../webs/webNetwork.js";
import { tryCutOrIgniteCocoon } from "../webs/webCocoon.js";
import { CREATURE_SPECS, type WildlifeEntity } from "../wildlife/creatureSpecs.js";
import { createArrowProjectile, type SimProjectile } from "../wildlife/projectileSim.js";
import type { WorldEcology } from "../wildlife/worldEcology.js";
import { buildPendingSwing, computeSwingNoiseRadius, type PendingMeleeSwing } from "./meleeTimeline.js";

const DEFAULT_MELEE_STATS = { cost: 8, damage: 10, range: 1.5, halfArc: 0.75, gore: "splatter" as GoreStyle };

function pickDefStats(def: NonNullable<ReturnType<typeof getItemDef>>, archetype: ReturnType<typeof resolveWeaponArchetype>) {
  const d = DEFAULT_MELEE_STATS;
  return {
    archetype, cost: def.staminaCost ?? d.cost, damage: def.damage ?? d.damage,
    range: def.range ?? d.range, halfArc: (def.arcRad ?? 1.5) * 0.5, gore: def.goreStyle ?? d.gore,
  };
}

export function meleeStatsFor(heldId: string | null) {
  const def = heldId ? getItemDef(heldId) : undefined;
  if (!def) return { ...DEFAULT_MELEE_STATS, archetype: resolveWeaponArchetype(heldId) };
  return pickDefStats(def, resolveWeaponArchetype(heldId, def.weaponArchetype));
}

function waterMoveMult(p: CombatPlayerRef): number {
  const m = COMBAT_TUNING.movementMults;
  if (p.inDeepWater) return p.combat.stamina <= 1 ? m.exhaustedSwim : m.deepWater;
  return p.inWater ? m.shallowWater : 1;
}

function windupMultForSwing(sw: PendingMeleeSwing): number {
  const m = COMBAT_TUNING.movementMults;
  if (sw.elapsedSec > sw.durationSec * sw.spec.windupEnd) return m.swing;
  if (sw.spec.weightTier === "light") return 0.85;
  return sw.spec.weightTier === "heavy" ? 0.58 : 0.72;
}

function baseActionMult(p: CombatPlayerRef): number {
  const m = COMBAT_TUNING.movementMults;
  if (p.combat.dodgeTimer > 0) return m.dodge;
  if (p.combat.pendingSwing) return windupMultForSwing(p.combat.pendingSwing);
  if (p.combat.swingTimer > 0) return m.swing;
  if (p.combat.blocking) return m.block;
  return p.combat.bowCharge > 0 ? m.bowDraw : 1;
}

function webMoveMult(p: CombatPlayerRef): number {
  if (p.combat.cocoonProgress >= 0.35 || p.combat.webStick >= MELEE_FEEL_TUNING.webStuckThreshold) return 0;
  return p.combat.webStick > 0.05 ? 1 - p.combat.webStick * 0.65 : 1;
}

export function computePlayerMoveMultiplier(p: CombatPlayerRef): number {
  const crouchMult = p.crouching ? STEALTH_TUNING.crouchSpeedMult : 1;
  return baseActionMult(p) * waterMoveMult(p) * crouchMult * webMoveMult(p);
}

export function buildPlayerCombatExtras(p: CombatPlayerRef) {
  const c = p.combat;
  return {
    hp: c.hp, maxHp: c.maxHp, stamina: Math.round(c.stamina), maxStamina: c.maxStamina, comboStep: c.comboStep,
    swingProgress: c.swingTimer > 0 ? Math.min(1, 1 - c.swingTimer / c.swingDuration) : 0,
    heavyCharge: c.heavyCharge, bowCharge: Math.min(1, c.bowCharge / BOW_MAX_CHARGE_SEC),
    blocking: c.blocking, dodging: c.dodgeTimer > 0, invulnTimer: c.invulnTimer, staggerTimer: c.staggerTimer,
    bleedTimer: c.bleedTimer, burnTimer: c.burnTimer, poisonTimer: c.poisonTimer, poisonLocked: c.poisonLocked,
    webSlowTimer: c.webSlowTimer, webStick: Number(c.webStick.toFixed(2)), cocoonProgress: Number(c.cocoonProgress.toFixed(2)),
    hitTimer: c.hitTimer, respawnTimer: c.respawnTimer, wellFedTimer: c.wellFedTimer, restedTimer: c.restedTimer,
    inSanctuary: isInSanctuary(p.x, p.y), ...(c.godMode ? { godMode: true } : {}),
  };
}

export function startTrackedMeleeSwing(opts: {
  readonly p: CombatPlayerRef & { attackFlashTimer?: number };
  readonly heldId: string | null;
  readonly events: WorldEvent[];
}): boolean {
  const { p, heldId, events } = opts;
  const c = p.combat;
  if (c.swingTimer > 0 || c.dodgeTimer > 0 || c.actionCooldown > 0 || c.pendingSwing) return false;
  const stats = meleeStatsFor(heldId);
  const shieldPoke = c.blocking && stats.archetype === "spear";
  const sw = buildPendingSwing({ state: c, heldId, archetype: stats.archetype, stats, aim: { x: p.aimX, y: p.aimY }, shieldPoke });
  if (!sw) return false;
  p.attackFlashTimer = STEALTH_TUNING.attackFlashSec;
  events.push({
    kind: "swing", x: p.x, y: p.y, dirX: p.aimX, dirY: p.aimY, actorId: p.id,
    comboStep: c.comboStep, weaponArchetype: stats.archetype, sweepDir: sw.spec.sweepDir,
  });
  return true;
}

function maybeEmitSlamImpact(opts: {
  readonly p: CombatPlayerRef; readonly sw: PendingMeleeSwing;
  readonly impactCenter: { readonly x: number; readonly y: number } | undefined; readonly events: WorldEvent[];
}): void {
  const { p, sw, impactCenter, events } = opts;
  if (sw.spec.motion !== "overheadSlam" || sw.slamEmitted || !impactCenter) return;
  sw.slamEmitted = true;
  events.push({
    kind: "slamImpact", x: impactCenter.x, y: impactCenter.y, dirX: sw.aimX, dirY: sw.aimY,
    actorId: p.id, weaponArchetype: sw.archetype, shakePx: sw.spec.shakePx, hitstopSec: sw.spec.hitstopSec,
  });
}

export function clearSwingOnCancel(p: CombatPlayerRef): void {
  const c = p.combat;
  c.pendingSwing = null; c.swingTimer = 0;
  c.heavyCharge = 0; c.actionCooldown = 0; c.bufferedAction = null;
}

export function clearSwingOnStagger(p: CombatPlayerRef): void {
  p.combat.bowCharge = 0; p.combat.pendingSwing = null; p.combat.heavyCharge = 0;
}

function buildSwingPayload(sw: PendingMeleeSwing, impactCenter: { readonly x: number; readonly y: number } | undefined, events: WorldEvent[]) {
  const heavy = sw.isHeavy;
  return {
    rawDamage: Math.round(sw.baseDamage * (heavy ? MELEE_FEEL_TUNING.heavyDamageMult : 1)),
    knockbackMult: sw.spec.knockbackMult * (heavy ? MELEE_FEEL_TUNING.heavyKnockbackMult : 1),
    shared: {
      range: sw.range, halfArcRad: sw.halfArcRad, goreStyle: sw.goreStyle, comboStep: sw.stepIndex,
      sweepDir: sw.spec.sweepDir, ignites: sw.spec.ignites, heavy, weaponArchetype: sw.archetype,
      hitstopSec: sw.spec.hitstopSec * (heavy ? 1.25 : 1),
      shakePx: heavy ? Math.max(sw.spec.shakePx, 3.0) : sw.spec.shakePx,
      hitTargetIds: sw.hitTargetIds, impactCenter, slamAoeRadius: sw.spec.slamAoeRadius, events,
    },
  };
}

export function runSwingActivePass(opts: {
  readonly cache: WorldChunkCache; readonly p: CombatPlayerRef; readonly players: Map<string, CombatPlayerRef>;
  readonly dummies: readonly SimEntity[]; readonly ecology: WorldEcology; readonly harvester: ResourceHarvester;
  readonly webs?: WorldWebNetwork | undefined; readonly sw: PendingMeleeSwing; readonly timeSec: number; readonly events: WorldEvent[];
}): void {
  const { cache, p, players, dummies, ecology, harvester, webs, sw, timeSec, events } = opts;
  const impactCenter = sw.spec.slamAoeRadius ? { x: p.x + sw.aimX * sw.range * 0.72, y: p.y + sw.aimY * sw.range * 0.72 } : undefined;
  maybeEmitSlamImpact({ p, sw, impactCenter, events });
  const { rawDamage, knockbackMult, shared } = buildSwingPayload(sw, impactCenter, events);
  resolveMeleeHits({ cache, attacker: p, players: players.values(), dummies, rawDamage, ...shared, webs });
  ecology.hitSector({
    attacker: p, dir: { x: sw.aimX, y: sw.aimY }, damage: rawDamage, backstabMult: sw.moveset.backstabMult,
    armorCrushMult: sw.spec.armorCrushMult, knockbackMult, ...shared,
  });
  if (webs) {
    const sharp = isSharpWeapon(sw.archetype);
    webs.slashOrBurnAt({ origin: p, dir: { x: sw.aimX, y: sw.aimY }, range: sw.range, halfArcRad: sw.halfArcRad, sharp, ignites: Boolean(sw.spec.ignites), events });
    tryCutOrIgniteCocoon({ target: p, sharp, ignites: Boolean(sw.spec.ignites), damage: rawDamage, actorId: p.id, events, webs });
  }
  if (!sw.noiseEmitted) {
    sw.noiseEmitted = true;
    ecology.emitNoise({ x: p.x, y: p.y, radius: computeSwingNoiseRadius(p.crouching), sourceId: p.id });
  }
  if (sw.harvested) return;
  sw.harvested = true;
  harvester.hitHarvestableInSector({
    cache, loot: ecology.loot, attacker: p, range: sw.range, halfArcRad: sw.halfArcRad,
    toolKind: sw.moveset.harvestKind, toolPower: sw.moveset.harvestPower, timeSec, events,
  });
}

export function applyCreatureStrikeToPlayer(opts: {
  readonly hitPlayer: CombatPlayerRef | undefined; readonly entity: WildlifeEntity; readonly events: WorldEvent[];
}): void {
  if (!opts.hitPlayer) return;
  const spec = CREATURE_SPECS[opts.entity.kind];
  applyIncomingPlayerHit({
    target: opts.hitPlayer, attackerOrigin: opts.entity, attackerId: opts.entity.id, rawDamage: spec.damage,
    goreStyle: spec.goreStyle, attackerIsPlayer: false, events: opts.events, appliesPoison: opts.entity.kind === "spider",
    shakePx: opts.entity.kind === "golem" ? 3.5 : undefined,
    onParry: () => {
      opts.entity.staggerTimer = PARRY_STAGGER_SEC;
      opts.entity.parried = true;
      opts.entity.telegraphTimer = 0;
      opts.entity.strikeTimer = 0;
    },
  });
}

export function spawnChargedBowArrow(opts: {
  readonly p: CombatPlayerRef & { attackFlashTimer?: number }; readonly chargeSec: number;
  readonly projId: string; readonly projectiles: SimProjectile[];
  readonly ecology: WorldEcology; readonly events: WorldEvent[];
}): void {
  const { p, chargeSec, projId, projectiles, ecology, events } = opts;
  const c = p.combat;
  if (!c.godMode) c.stamina -= 10;
  c.actionCooldown = 0.25;
  p.attackFlashTimer = STEALTH_TUNING.attackFlashSec;
  const shot = evaluateBowShot(chargeSec);
  projectiles.push(createArrowProjectile({
    id: projId, p, speed: shot.speedTilesPerSec, charge: shot.ratio,
    damage: Math.round((getItemDef("bow")?.damage ?? 22) * shot.damageMult),
  }));
  events.push({ kind: "arrowFire", x: p.x, y: p.y, dirX: p.aimX, dirY: p.aimY, actorId: p.id, value: shot.ratio });
  ecology.emitNoise({ x: p.x, y: p.y, radius: p.crouching ? 3.2 : STEALTH_TUNING.combatNoiseRadiusTiles, sourceId: p.id });
}

export function stepStationaryPlayerTurn(opts: {
  readonly cache: WorldChunkCache; readonly p: {
    x: number; y: number; readonly elevation: number; readonly jumpZ: number;
    readonly facingX: number; readonly facingY: number; readonly aimX: number; readonly aimY: number;
    readonly heldItem?: string | null | undefined; readonly bowCharge: number; readonly heavyCharge: number;
  };
}): void {
  const { p } = opts;
  if (p.jumpZ > 0.02) return;
  const seg = playerFootSegment(p);
  const res = resolveMovement({
    cache: opts.cache, x: p.x, y: p.y, dx: 0, dy: 0,
    radius: COMBAT_TUNING.movement.collisionRadiusTiles,
    footSegX: seg.segX, footSegY: seg.segY, elevation: p.elevation, airborne: false, jumpZ: 0,
  });
  p.x = res.x; p.y = res.y;
}
