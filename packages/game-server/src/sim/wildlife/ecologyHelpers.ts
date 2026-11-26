/** Pure overworld ecology combat math, POI placement helpers, and entity snapshot serialization. */
import { BLEED_DURATION_SEC, MELEE_FEEL_TUNING, STEALTH_TUNING, WorldChunkCache, attackHitboxHitsHurtbox, buildEntityAttackHitbox, buildPlayerAttackHitbox, entityHurtbox, findTilePath, getEntityAttackSpec, isArmorCrushTarget, isBackstabAngle, isInSanctuary, playerHurtbox, type ChunkPoi, type GoreStyle, type GoreSubstance, type WeaponArchetype, type WorldEntitySnapshot, type WorldEvent } from "@dc2d/engine";
import { igniteBurnable } from "../combat/statusEffects.js";
import type { CombatPlayerRef } from "../combatActions.js";
import type { CombatPlayerCandidate, EcologyFoodSource, SteerTarget } from "./creatureBehaviors.js";
import { applyKnockbackImpulse, clearNavPath, isClearSpot } from "./creatureNavigation.js";
import {
  CREATURE_SPECS, ST_ALERT, ST_AMBUSH, ST_FEED, ST_FLANK, ST_IDLE, ST_INVESTIGATE, ST_PATROL, ST_RETURN,
  type CreatureArchetypeSpec, type WildlifeEntity, type WildlifeKind,
} from "./creatureSpecs.js";
import { wakeEntityFromHit, type CombatTarget } from "./factionTargeting.js";

const KIND_SLIME: WildlifeKind = "slime";
const BLEED_SUBSTANCES = new Set<GoreSubstance>(["blood", "slime", "ichor"]);
export const UNAWARE_STATES = new Set([ST_IDLE, ST_PATROL, ST_INVESTIGATE, ST_FEED, ST_AMBUSH]);

export const isCocoonedFromSpider = (
  e: WildlifeEntity, p: { readonly combat?: { readonly cocoonProgress?: number } | undefined },
): boolean => e.kind === "spider" && (p.combat?.cocoonProgress ?? 0) >= 1;

export function computeSectorStrike(
  attacker: CombatPlayerRef,
  e: WildlifeEntity,
  opts: { readonly baseDmg: number; readonly backstabMult?: number | undefined; readonly armorCrushMult?: number | undefined },
): { readonly damage: number; readonly sneakHit: boolean } {
  const unaware = e.targetPlayerId === null || UNAWARE_STATES.has(e.aiState);
  const sneakHit = unaware && (Boolean(attacker.crouching) || isBackstabAngle({ attacker, target: e, targetFacing: { x: e.facingX, y: e.facingY } }));
  const bsMult = sneakHit ? (opts.backstabMult ?? STEALTH_TUNING.backstabDamageMult) : 1;
  const armorMult = opts.armorCrushMult && isArmorCrushTarget(e.kind) ? opts.armorCrushMult : 1;
  return { sneakHit, damage: Math.round(opts.baseDmg * bsMult * armorMult) };
}

export function steerGoblinAllyRetreat(e: WildlifeEntity, target: CombatTarget, entities: readonly WildlifeEntity[]): SteerTarget | null {
  if (e.kind !== "goblin") return null;
  if (!e.goblinRetreated && e.hp < e.maxHp * 0.25) {
    const orc = entities.find((o) => !o.corpse && o.hp > 0 && o.kind === "orc" && Math.hypot(o.x - e.x, o.y - e.y) <= 12);
    if (orc) { e.goblinRetreated = true; e.goblinRetreatTimer = 2.4; }
  }
  if (e.goblinRetreatTimer <= 0) return null;
  const orc = entities.find((o) => !o.corpse && o.hp > 0 && o.kind === "orc" && Math.hypot(o.x - e.x, o.y - e.y) <= 14);
  if (!orc) { e.goblinRetreatTimer = 0; return null; }
  const dx = orc.x - target.x; const dy = orc.y - target.y;
  const mag = Math.max(0.01, Math.hypot(dx, dy));
  e.aiState = ST_FLANK;
  return { x: orc.x + (dx / mag) * 1.8, y: orc.y + (dy / mag) * 1.8, speedMult: 1.22 };
}

export function applyBackstabEvent(opts: { readonly e: WildlifeEntity; readonly attackerId: string; readonly damage: number; readonly sneakHit: boolean; readonly events: WorldEvent[] }): void {
  if (!opts.sneakHit) return;
  opts.e.staggerTimer = Math.max(opts.e.staggerTimer, 0.85);
  opts.events.push({ kind: "backstab", x: opts.e.x, y: opts.e.y, value: opts.damage, actorId: opts.attackerId, targetId: opts.e.id, hitstopSec: MELEE_FEEL_TUNING.backstabHitstopSec, shakePx: MELEE_FEEL_TUNING.backstabShakePx });
}

export function applyWildlifeBleed(e: WildlifeEntity, substance: GoreSubstance, goreStyle: GoreStyle): void {
  if (!BLEED_SUBSTANCES.has(substance)) return;
  if (goreStyle === "drip") { e.bleedTimer = BLEED_DURATION_SEC; return; }
  if (e.hp <= e.maxHp * 0.5) e.bleedTimer = Math.max(e.bleedTimer, BLEED_DURATION_SEC * 0.85);
}

export function resolveWildlifeGore(opts: {
  readonly e: WildlifeEntity; readonly spec: CreatureArchetypeSpec;
  readonly fatal: boolean; readonly goreStyle: GoreStyle; readonly comboStep?: number | undefined;
}): GoreStyle {
  if (!opts.fatal) return opts.goreStyle;
  if (opts.e.kind === KIND_SLIME) return "explode-away";
  return opts.comboStep === 3 ? "chunk-spray" : opts.spec.fatalStyle;
}

function isGuardSpotOpen(cache: WorldChunkCache, poi: ChunkPoi, pt: { readonly x: number; readonly y: number }): boolean {
  if (cache.tileAt(pt.x, pt.y).elevation !== poi.elevation || !isClearSpot(cache, { x: pt.x, y: pt.y, pad: 0.38 })) return false;
  return findTilePath({ cache, startX: pt.x, startY: pt.y, goalX: poi.centerX, goalY: poi.centerY + poi.radiusY - 0.4, maxRadiusTiles: 12 }).reachedGoal;
}

export function findClearGuardSpot(
  cache: WorldChunkCache,
  poi: ChunkPoi,
  raw: { readonly x: number; readonly y: number },
): { readonly x: number; readonly y: number } {
  const yardY = poi.centerY + 0.6;
  for (const pull of [0, 0.28, 0.55, 0.8]) {
    const pt = { x: raw.x + (poi.centerX - raw.x) * pull, y: raw.y + (yardY - raw.y) * pull };
    if (isGuardSpotOpen(cache, poi, pt)) return pt;
  }
  const fallback = { x: poi.centerX, y: poi.centerY + Math.min(1.8, Math.max(0.8, poi.radiusY - 0.8)) };
  return isClearSpot(cache, { ...fallback, pad: 0.34 }) ? fallback : { x: poi.centerX, y: poi.centerY + 1.8 };
}

export function collectScavengeFoods(
  entities: readonly WildlifeEntity[],
  loot: readonly { readonly id: string; readonly itemId: string; readonly x: number; readonly y: number }[],
  isMeat: (id: string) => boolean,
): EcologyFoodSource[] {
  return [
    ...entities.filter((m) => m.corpse).map((m) => ({ x: m.x, y: m.y, entityId: m.id })),
    ...loot.filter((g) => isMeat(g.itemId)).map((g) => ({ x: g.x, y: g.y, isMeatLoot: true, lootId: g.id })),
  ];
}

function applyCreatureRiposteAndWake(opts: {
  readonly list: readonly WildlifeEntity[]; readonly players: readonly CombatPlayerCandidate[];
  readonly entity: WildlifeEntity; readonly baseDamage: number; readonly dirX: number; readonly dirY: number;
  readonly actorId: string; readonly events: WorldEvent[];
}): number {
  const { entity: e, actorId, events } = opts;
  let dmg = e.stunnedTimer > 0 ? Math.round(opts.baseDamage * 1.35) : opts.baseDamage;
  if (e.parried && e.staggerTimer > 0) {
    dmg = Math.round(dmg * MELEE_FEEL_TUNING.riposteDamageMult);
    e.parried = false;
    events.push({ kind: "riposte", x: e.x, y: e.y, value: dmg, actorId, targetId: e.id, hitstopSec: MELEE_FEEL_TUNING.parryHitstopSec, shakePx: 3.0 });
  }
  e.hp = Math.max(0, e.hp - dmg);
  e.hitTimer = 0.24; e.alertedTimer = 6.0; e.provokedTimer = 5.0;
  if (e.aiState === ST_RETURN) { e.aiState = ST_ALERT; clearNavPath(e); }
  return dmg;
}

function applyNonFatalStatuses(opts: {
  readonly entity: WildlifeEntity; readonly dmg: number; readonly dirX: number; readonly dirY: number;
  readonly goreStyle: GoreStyle; readonly ignites?: boolean | undefined; readonly knockbackMult?: number | undefined; readonly events: WorldEvent[];
}): void {
  const { entity: e, dmg, dirX, dirY, goreStyle, events } = opts;
  const spec = CREATURE_SPECS[e.kind];
  applyKnockbackImpulse(e, { dirX, dirY, force: (dmg >= 22 ? 8.0 : 6.4) * (opts.knockbackMult ?? 1) });
  e.staggerTimer = Math.max(e.staggerTimer, Math.max(0.03, 0.13 * (1 - spec.knockbackResist * 0.75)));
  applyWildlifeBleed(e, spec.substance, goreStyle);
  if (opts.ignites) igniteBurnable({ target: e, x: e.x, y: e.y, targetId: e.id, events });
}

export function isSectorTargetHit(opts: {
  readonly cache?: WorldChunkCache | undefined; readonly e: WildlifeEntity; readonly attacker: CombatPlayerRef; readonly dir: { readonly x: number; readonly y: number };
  readonly range: number; readonly halfArcRad: number; readonly hitTargetIds?: Set<string> | undefined;
  readonly impactCenter?: { readonly x: number; readonly y: number } | undefined; readonly slamAoeRadius?: number | undefined;
}): boolean {
  const { cache, e, attacker, dir, range, halfArcRad, hitTargetIds, impactCenter, slamAoeRadius } = opts;
  if (e.corpse || e.hp <= 0 || hitTargetIds?.has(e.id)) return false;
  const hitbox = buildPlayerAttackHitbox({
    cache, x: attacker.x, y: attacker.y, elevation: attacker.elevation, dir, range, halfArcRad, impactCenter, slamAoeRadius,
  });
  return attackHitboxHitsHurtbox(hitbox, entityHurtbox(e, e.kind, cache));
}

function strikeCandidatePlayers(opts: {
  readonly cache?: WorldChunkCache | undefined; readonly e: WildlifeEntity; readonly players: readonly CombatPlayerCandidate[];
  readonly hitbox: ReturnType<typeof buildEntityAttackHitbox>; readonly onStrike: (entity: WildlifeEntity, target: CombatTarget) => void;
}): void {
  const { cache, e, players, hitbox, onStrike } = opts;
  for (const p of players) {
    if (e.strikeHitIds.has(p.id) || isInSanctuary(p.x, p.y)) continue;
    if (!attackHitboxHitsHurtbox(hitbox, playerHurtbox(p, cache))) continue;
    e.strikeHitIds.add(p.id);
    onStrike(e, { ...p, targetKind: "player" });
    if (e.kind === "wolf") e.peelTimer = 0.85;
  }
}

function strikeLockedRival(opts: {
  readonly cache?: WorldChunkCache | undefined; readonly e: WildlifeEntity; readonly allEntities: readonly WildlifeEntity[];
  readonly hitbox: ReturnType<typeof buildEntityAttackHitbox>; readonly onStrike: (entity: WildlifeEntity, target: CombatTarget) => void;
}): void {
  const { cache, e, allEntities, hitbox, onStrike } = opts;
  if (e.targetKind !== "entity" || !e.targetPlayerId || e.strikeHitIds.has(e.targetPlayerId)) return;
  const rival = allEntities.find((m) => m.id === e.targetPlayerId && !m.corpse && m.hp > 0);
  if (!rival || !attackHitboxHitsHurtbox(hitbox, entityHurtbox(rival, rival.kind, cache))) return;
  e.strikeHitIds.add(rival.id);
  onStrike(e, { id: rival.id, x: rival.x, y: rival.y, elevation: rival.elevation, moving: false, targetKind: "entity", entityRef: rival });
}

export function evaluateActiveCreatureStrike(opts: {
  readonly cache?: WorldChunkCache | undefined; readonly e: WildlifeEntity; readonly players: readonly CombatPlayerCandidate[];
  readonly allEntities: readonly WildlifeEntity[]; readonly onStrike: (entity: WildlifeEntity, target: CombatTarget) => void;
}): void {
  const hitbox = buildEntityAttackHitbox(opts.e, opts.cache);
  strikeCandidatePlayers({ cache: opts.cache, e: opts.e, players: opts.players, hitbox, onStrike: opts.onStrike });
  strikeLockedRival({ cache: opts.cache, e: opts.e, allEntities: opts.allEntities, hitbox, onStrike: opts.onStrike });
}

export function beginCreatureStrike(opts: {
  readonly cache?: WorldChunkCache | undefined; readonly e: WildlifeEntity; readonly players: readonly CombatPlayerCandidate[]; readonly allEntities: readonly WildlifeEntity[];
  readonly events: WorldEvent[]; readonly onStrike: (entity: WildlifeEntity, target: CombatTarget) => void;
}): void {
  const { e, events } = opts;
  const atk = getEntityAttackSpec(e.kind);
  e.attackCooldown = CREATURE_SPECS[e.kind].cooldownSec;
  e.strikeTimer = atk.activeSec; e.strikeDuration = atk.activeSec; e.strikeHitIds.clear();
  events.push({ kind: "swing", x: e.x, y: e.y, dirX: e.facingX, dirY: e.facingY, actorId: e.id, entityKind: e.kind, ...(e.kind === "golem" ? { shakePx: 3.5 } : {}) });
  evaluateActiveCreatureStrike(opts);
}

export function stepCreatureStrikeWindow(opts: {
  readonly cache?: WorldChunkCache | undefined; readonly e: WildlifeEntity; readonly players: readonly CombatPlayerCandidate[]; readonly allEntities: readonly WildlifeEntity[];
  readonly dt: number; readonly onStrike: (entity: WildlifeEntity, target: CombatTarget) => void;
}): void {
  if (opts.e.strikeTimer <= 0) return;
  opts.e.strikeTimer = Math.max(0, opts.e.strikeTimer - opts.dt);
  evaluateActiveCreatureStrike(opts);
}

function finalizeCreatureDamageStatus(opts: {
  readonly entity: WildlifeEntity; readonly dmg: number; readonly fatal: boolean; readonly dirX: number; readonly dirY: number;
  readonly goreStyle: GoreStyle; readonly ignites?: boolean | undefined; readonly knockbackMult?: number | undefined; readonly events: WorldEvent[];
}): void {
  const { entity: e, fatal } = opts;
  if (!fatal) { applyNonFatalStatuses(opts); return; }
  e.burnTimer = 0; e.burnTickAcc = 0; e.parried = false;
}

export function applyDamageToCreature(opts: {
  readonly list: readonly WildlifeEntity[]; readonly players: readonly CombatPlayerCandidate[];
  readonly entity: WildlifeEntity; readonly damage: number; readonly dirX: number; readonly dirY: number;
  readonly goreStyle: GoreStyle; readonly comboStep?: number | undefined; readonly sweepDir?: number | undefined;
  readonly actorId: string; readonly events: WorldEvent[]; readonly silentKill?: boolean;
  readonly ignites?: boolean | undefined; readonly heavy?: boolean | undefined; readonly weaponArchetype?: WeaponArchetype | undefined;
  readonly hitstopSec?: number | undefined; readonly shakePx?: number | undefined; readonly knockbackMult?: number | undefined;
}): { readonly dmg: number; readonly fatal: boolean } {
  const e = opts.entity;
  const spec = CREATURE_SPECS[e.kind];
  const dmg = applyCreatureRiposteAndWake({ ...opts, baseDamage: opts.damage });
  const fatal = e.hp <= 0;
  if (!(fatal && opts.silentKill)) {
    wakeEntityFromHit({ entity: e, dirX: opts.dirX, dirY: opts.dirY, actorId: opts.actorId, allEntities: opts.list, players: opts.players });
  }
  finalizeCreatureDamageStatus({ entity: e, dmg, fatal, dirX: opts.dirX, dirY: opts.dirY, goreStyle: opts.goreStyle, ignites: opts.ignites, knockbackMult: opts.knockbackMult, events: opts.events });
  const goreStyle = resolveWildlifeGore({ e, spec, fatal, goreStyle: opts.goreStyle, comboStep: opts.comboStep });
  opts.events.push({
    kind: "hit", x: e.x, y: e.y, dirX: opts.dirX, dirY: opts.dirY, value: dmg,
    actorId: opts.actorId, targetId: e.id, comboStep: opts.comboStep, sweepDir: opts.sweepDir,
    goreStyle, substance: spec.substance, fatal, entityKind: e.kind,
    ...(opts.heavy ? { heavy: true } : {}), ...(opts.weaponArchetype ? { weaponArchetype: opts.weaponArchetype } : {}),
    ...(opts.hitstopSec !== undefined ? { hitstopSec: opts.hitstopSec } : {}), ...(opts.shakePx !== undefined ? { shakePx: opts.shakePx } : {}),
  });
  return { dmg, fatal };
}

function resolveSnapshotAttackProgress(e: WildlifeEntity): number {
  if (e.chargeTimer > 0 && !e.chargeHitDealt) return 1;
  if (e.strikeTimer <= 0) return 0;
  return Math.min(1, Math.max(0.05, 1 - e.strikeTimer / Math.max(0.05, e.strikeDuration)));
}

function serializeBehaviorFlags(e: WildlifeEntity) {
  return {
    ...(e.stunnedTimer > 0 ? { stunned: true } : {}),
    ...(e.howlTimer > 0 ? { howling: true } : {}),
    ...(e.bluffTimer > 0 ? { bluffing: true } : {}),
    ...(e.scentTrackTimer > 0 && e.aiState === ST_INVESTIGATE ? { sniffing: true } : {}),
  };
}

function serializeEntityFlags(e: WildlifeEntity) {
  const atkProg = resolveSnapshotAttackProgress(e);
  return {
    ...serializeBehaviorFlags(e),
    ...(e.burnTimer > 0 ? { burning: true } : {}),
    ...(e.parried && e.staggerTimer > 0 ? { parried: true } : {}),
    ...(atkProg > 0 ? { attackProgress: atkProg } : {}),
  };
}

export function serializeEntitySnapshot(e: WildlifeEntity): WorldEntitySnapshot {
  const prog = e.telegraphTimer > 0 ? Math.min(1, 1 - e.telegraphTimer / Math.max(0.05, e.windupDuration)) : 0;
  return {
    id: e.id, kind: e.kind, substance: e.substance, x: e.x, y: e.y, elevation: e.elevation, jumpZ: e.jumpZ,
    facingX: e.facingX, facingY: e.facingY, hp: e.hp, maxHp: e.maxHp, hitTimer: e.hitTimer,
    staggerTimer: e.staggerTimer, bleedTimer: e.bleedTimer, aiState: e.aiState, spottedPop: e.spottedPopTimer > 0,
    corpse: e.corpse, inWater: e.inWater, inDeepWater: e.inDeepWater, telegraphProgress: prog,
    suspicion: Number(e.suspicion.toFixed(2)),
    ...(e.isElite ? { isElite: true } : {}),
    ...(e.title ? { title: e.title } : {}),
    ...(e.dangerTier > 1 ? { dangerTier: e.dangerTier } : {}),
    ...serializeEntityFlags(e),
  };
}
