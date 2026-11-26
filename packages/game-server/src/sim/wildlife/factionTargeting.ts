/** Multi-faction hostile target sensing, gradual suspicion fill, group/corpse alerting, and hit wakeup. */
import {
  AI_TUNING, STEALTH_TUNING, WorldChunkCache, canHearTarget, canPerceiveTarget,
  computeLineOfSightClarity, hasElevationLineOfSight, isInSanctuary, isInWorldSanctuary,
} from "@dc2d/engine";
import { clearNavPath } from "./creatureNavigation.js";
import type { CombatPlayerCandidate } from "./creatureBehaviors.js";
import { isCocoonedFromSpider } from "./ecologyHelpers.js";
import {
  CREATURE_SPECS, ST_INVESTIGATE, ST_RETURN,
  type WildlifeEntity, type WildlifeKind,
} from "./creatureSpecs.js";

export type CreatureFaction = "bandit" | "ruins" | "wolf" | "bear" | "boar" | "spider" | "slime";

export interface CombatTarget extends CombatPlayerCandidate {
  readonly targetKind: "player" | "entity";
  readonly entityRef?: WildlifeEntity | undefined;
}

export function factionOfKind(kind: WildlifeKind): CreatureFaction {
  if (kind === "goblin" || kind === "orc") return "bandit";
  if (kind === "skeleton" || kind === "golem") return "ruins";
  return kind;
}

export const areFactionsHostile = (a: CreatureFaction, b: CreatureFaction): boolean => a !== b;

function hasTrackedSight(opts: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly cand: CombatTarget; readonly dist: number;
}, visionRange: number): boolean {
  const clarity = computeLineOfSightClarity({
    cache: opts.cache, fromX: opts.e.x, fromY: opts.e.y, fromElev: opts.e.elevation,
    toX: opts.cand.x, toY: opts.cand.y, toElev: opts.cand.elevation,
  });
  if (clarity <= 0.08) return false;
  if (opts.cand.targetKind === "player") {
    const effectiveVis = (opts.cand.visibility ?? 1) * (0.4 + 0.6 * clarity);
    if (effectiveVis <= 0.45 && opts.dist > Math.max(3.2, visionRange * (0.45 + 0.65 * effectiveVis))) return false;
  }
  return true;
}

function canTrackExistingTarget(opts: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly cand: CombatTarget; readonly dist: number;
}, visionRange: number): boolean | null {
  const { e, cand, dist } = opts;
  const alertedFocus = cand.targetKind === "player" || e.targetPlayerId === cand.id;
  if (alertedFocus && e.alertedTimer > 0 && dist <= visionRange * 1.25) {
    return dist <= 2.4 || hasTrackedSight(opts, visionRange);
  }
  if (e.targetPlayerId === cand.id && dist <= visionRange * 1.55) {
    return hasTrackedSight(opts, visionRange);
  }
  return null;
}

function canSeeCandidate(opts: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly cand: CombatTarget;
  readonly dist: number; readonly rangeMult: number; readonly visOverride?: number;
}): boolean {
  const spec = CREATURE_SPECS[opts.e.kind];
  const tracked = canTrackExistingTarget(opts, spec.visionRange);
  if (tracked !== null) return tracked;
  const target = opts.visOverride !== undefined ? { ...opts.cand, visibility: opts.visOverride } : opts.cand;
  return canPerceiveTarget({
    cache: opts.cache, observer: opts.e, target,
    visionRange: spec.visionRange * opts.rangeMult, halfConeRad: AI_TUNING.halfConeRad, hearRange: spec.hearRange,
  });
}

function asEntityTarget(o: WildlifeEntity): CombatTarget {
  return { id: o.id, x: o.x, y: o.y, elevation: o.elevation, moving: true, facingX: o.facingX, facingY: o.facingY, targetKind: "entity", entityRef: o };
}

export function resolveLockedTarget(opts: {
  readonly id: string; readonly players: readonly CombatPlayerCandidate[]; readonly allEntities: readonly WildlifeEntity[]; readonly cache?: WorldChunkCache | undefined;
}): CombatTarget | null {
  const safe = (x: number, y: number): boolean => (opts.cache ? isInWorldSanctuary(opts.cache, x, y) : isInSanctuary(x, y));
  const pl = opts.players.find((p) => p.id === opts.id && !safe(p.x, p.y));
  if (pl) return { ...pl, targetKind: "player" };
  const ent = opts.allEntities.find((o) => o.id === opts.id && !o.corpse && o.hp > 0 && !safe(o.x, o.y));
  return ent ? asEntityTarget(ent) : null;
}

export function findHeardHostilePlayer(opts: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly players: readonly CombatPlayerCandidate[];
}): CombatTarget | null {
  const spec = CREATURE_SPECS[opts.e.kind];
  let target: CombatTarget | null = null;
  let dist = Infinity;
  for (const p of opts.players) {
    const d = isCocoonedFromSpider(opts.e, p) || isInWorldSanctuary(opts.cache, p.x, p.y) ? Infinity : Math.hypot(p.x - opts.e.x, p.y - opts.e.y);
    if (d < dist && canHearTarget({ cache: opts.cache, observer: opts.e, target: p, visionRange: spec.visionRange, halfConeRad: AI_TUNING.halfConeRad, hearRange: spec.hearRange })) {
      dist = d; target = { ...p, targetKind: "player" };
    }
  }
  return target;
}

function findBestPlayerTarget(opts: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly players: readonly CombatPlayerCandidate[];
}): { readonly target: CombatTarget; readonly dist: number } | null {
  let target: CombatTarget | null = null;
  let dist = Infinity;
  for (const p of opts.players) {
    if (isCocoonedFromSpider(opts.e, p) || isInWorldSanctuary(opts.cache, p.x, p.y)) continue;
    const d = Math.hypot(p.x - opts.e.x, p.y - opts.e.y);
    const cand: CombatTarget = { ...p, targetKind: "player" };
    if (d < dist && canSeeCandidate({ cache: opts.cache, e: opts.e, cand, dist: d, rangeMult: 1 })) {
      dist = d; target = cand;
    }
  }
  return target ? { target, dist } : null;
}

function isEligibleHostileEntity(cache: WorldChunkCache, e: WildlifeEntity, o: WildlifeEntity): boolean {
  if (o.corpse || o.hp <= 0 || o.id === e.id || isInWorldSanctuary(cache, o.x, o.y)) return false;
  if (e.poiId !== null && e.poiId === o.poiId) return false;
  return areFactionsHostile(factionOfKind(e.kind), factionOfKind(o.kind));
}

function isCalmBehindWithPlayer(e: WildlifeEntity, o: WildlifeEntity, hasPlayer: boolean): boolean {
  if (!hasPlayer || o.targetPlayerId !== null) return false;
  return (o.x - e.x) * e.facingX + (o.y - e.y) * e.facingY < 0;
}

function scoreEntityCandidate(opts: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly o: WildlifeEntity;
  readonly maxDist: number; readonly hasPlayer: boolean;
}): number | null {
  const { cache, e, o, maxDist, hasPlayer } = opts;
  if (!isEligibleHostileEntity(cache, e, o) || isCalmBehindWithPlayer(e, o, hasPlayer)) return null;
  const d = Math.hypot(o.x - e.x, o.y - e.y);
  if (d >= maxDist) return null;
  const mult = e.targetPlayerId === o.id ? 1.0 : 0.85;
  return canSeeCandidate({ cache, e, cand: asEntityTarget(o), dist: d, rangeMult: mult, visOverride: 0.9 }) ? d : null;
}

function findBestEntityTarget(opts: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly allEntities: readonly WildlifeEntity[];
  readonly maxDist: number; readonly hasPlayer: boolean;
}): { readonly target: CombatTarget; readonly dist: number } | null {
  let target: CombatTarget | null = null;
  let dist = opts.maxDist;
  for (const o of opts.allEntities) {
    const d = scoreEntityCandidate({ cache: opts.cache, e: opts.e, o, maxDist: dist, hasPlayer: opts.hasPlayer });
    if (d !== null) { dist = d; target = asEntityTarget(o); }
  }
  return target ? { target, dist } : null;
}

export function findBestHostileTarget(opts: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity;
  readonly players: readonly CombatPlayerCandidate[]; readonly allEntities: readonly WildlifeEntity[];
}): CombatTarget | null {
  const bestPlayer = findBestPlayerTarget(opts);
  const bestEntity = findBestEntityTarget({ ...opts, maxDist: bestPlayer ? bestPlayer.dist : Infinity, hasPlayer: bestPlayer !== null });
  return bestEntity ? bestEntity.target : (bestPlayer?.target ?? null);
}

function isAlertedOrClose(e: WildlifeEntity, perceived: CombatTarget, dist: number): boolean {
  const vis = perceived.visibility ?? 1;
  if (e.targetPlayerId === perceived.id || e.alertedTimer > 0 || e.provokedTimer > 0) return true;
  return perceived.targetKind === "entity" || (dist <= 3.0 && vis >= 0.65);
}

function hasInstantSuspicionLock(e: WildlifeEntity, perceived: CombatTarget, dist: number): boolean {
  const vis = perceived.visibility ?? 1;
  if (isAlertedOrClose(e, perceived, dist)) return true;
  return e.huntedTargetId === perceived.id && e.investigateTimer > 0 && (dist <= 5.5 || vis >= 0.55);
}

function applySuspectState(e: WildlifeEntity, perceived: CombatTarget): void {
  e.aiState = ST_INVESTIGATE;
  e.lastKnownX = perceived.x; e.lastKnownY = perceived.y;
  e.searchPhase = "move_to_clue"; e.searchPhaseTimer = 0;
  e.investigateTimer = Math.max(e.investigateTimer, CREATURE_SPECS[e.kind].sensory.searchDurationSec);
  const mag = Math.max(0.01, Math.hypot(perceived.x - e.x, perceived.y - e.y));
  e.facingX = (perceived.x - e.x) / mag; e.facingY = (perceived.y - e.y) / mag;
  e.searchAnchorAngle = Math.atan2(e.facingY, e.facingX);
}

export function decayUnseenSuspicion(e: WildlifeEntity, dt: number): void {
  if (e.investigateTimer > 0) {
    const floor = e.scentTrackTimer > 0 ? 0.65 : 0.35;
    if (e.suspicion >= floor) { e.suspicion = Math.max(floor, e.suspicion - dt * 0.08); return; }
  }
  e.suspicion = Math.max(0, e.suspicion - dt * 0.35);
}

export function stepSuspicionForTarget(opts: {
  readonly e: WildlifeEntity; readonly perceived: CombatTarget; readonly dt: number;
}): "engage" | "suspicious" {
  const { e, perceived, dt } = opts;
  const dist = Math.hypot(perceived.x - e.x, perceived.y - e.y);
  if (hasInstantSuspicionLock(e, perceived, dist)) { e.suspicion = 1.0; return "engage"; }
  const vis = perceived.visibility ?? 1;
  const prox = Math.max(0, 1 - dist / Math.max(1, CREATURE_SPECS[e.kind].visionRange));
  const fillRate = vis >= 0.85 ? 10.5 : 0.65 + vis * 1.15 + prox * 0.7;
  e.suspicion = Math.min(1, e.suspicion + fillRate * dt);
  if (e.suspicion >= 1.0) return "engage";
  if (e.suspicion >= 0.35) applySuspectState(e, perceived);
  return "suspicious";
}

const SOCIAL_ALERT_FACTIONS = new Set<CreatureFaction>(["bandit", "ruins", "wolf", "slime"]);

function hasLosToPeer(cache: WorldChunkCache, e: WildlifeEntity, o: WildlifeEntity): boolean {
  return hasElevationLineOfSight({ cache, fromX: e.x, fromY: e.y, fromElev: e.elevation, toX: o.x, toY: o.y, toElev: o.elevation });
}
interface PeerNoticeCtx { readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly o: WildlifeEntity; readonly dist: number; }
function noticeCorpse(ctx: PeerNoticeCtx): boolean {
  const { cache, e, o, dist } = ctx;
  if (!o.corpse || dist > 6.5 || !hasLosToPeer(cache, e, o)) return false;
  e.suspicion = Math.max(e.suspicion, 0.65); e.aiState = ST_INVESTIGATE;
  e.lastKnownX = o.x; e.lastKnownY = o.y; e.investigateTimer = Math.max(e.investigateTimer, 6.0);
  return true;
}
function noticeBuddy(ctx: PeerNoticeCtx): boolean {
  const { cache, e, o, dist } = ctx;
  const social = SOCIAL_ALERT_FACTIONS.has(factionOfKind(e.kind)) || (e.packId !== null && e.packId === o.packId);
  if (!social || o.corpse || !o.targetPlayerId || dist > 9.0 || !hasLosToPeer(cache, e, o)) return false;
  e.targetPlayerId = o.targetPlayerId; e.targetKind = o.targetKind; e.lastKnownX = o.lastKnownX; e.lastKnownY = o.lastKnownY;
  e.suspicion = 1.0; e.alertedTimer = 5.0; e.spottedPopTimer = STEALTH_TUNING.spottedPopDurationSec;
  return true;
}
export function isCreatureAggro(e: WildlifeEntity): boolean { return e.targetPlayerId !== null || e.telegraphTimer > 0 || e.chargeTimer > 0; }
function scanFactionPeers(opts: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly allEntities: readonly WildlifeEntity[];
  readonly myFaction: CreatureFaction; readonly check: (ctx: PeerNoticeCtx) => boolean;
}): boolean {
  for (const o of opts.allEntities) {
    if (o.id !== opts.e.id && factionOfKind(o.kind) === opts.myFaction && opts.check({ cache: opts.cache, e: opts.e, o, dist: Math.hypot(o.x - opts.e.x, o.y - opts.e.y) })) return true;
  }
  return false;
}
export function scanAlliesAndCorpses(opts: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly allEntities: readonly WildlifeEntity[]; readonly players: readonly CombatPlayerCandidate[];
}): void {
  const { cache, e, allEntities } = opts;
  if (isCreatureAggro(e) || e.aiState === ST_RETURN || e.provokedTimer > 0) return;
  const myFaction = factionOfKind(e.kind);
  if (!scanFactionPeers({ cache, e, allEntities, myFaction, check: noticeBuddy })) scanFactionPeers({ cache, e, allEntities, myFaction, check: noticeCorpse });
}

export function wakeEntityFromHit(opts: {
  readonly entity: WildlifeEntity; readonly dirX: number; readonly dirY: number;
  readonly actorId: string; readonly allEntities: readonly WildlifeEntity[];
  readonly players?: readonly CombatPlayerCandidate[] | undefined;
}): void {
  const { entity: e, dirX, dirY, actorId, allEntities, players = [] } = opts;
  const mag = Math.max(0.01, Math.hypot(dirX, dirY));
  const nx = dirX / mag; const ny = dirY / mag;
  e.suspicion = Math.max(e.suspicion, 0.9);
  e.investigateTimer = Math.max(e.investigateTimer, CREATURE_SPECS[e.kind].sensory.searchDurationSec);
  e.aiState = ST_INVESTIGATE;
  e.searchPhase = "move_to_clue"; e.searchPhaseTimer = 0;
  e.investigateElapsed = 0; e.scentHuntElapsed = 0;
  e.facingX = -nx; e.facingY = -ny;
  e.searchAnchorAngle = Math.atan2(-ny, -nx);
  clearNavPath(e);
  const attacker = resolveLockedTarget({ id: actorId, players, allEntities });
  if (attacker) { e.huntedTargetId = attacker.id; e.huntedTargetKind = attacker.targetKind; }
  if (attacker && Math.hypot(attacker.x - e.x, attacker.y - e.y) <= 14.0) {
    e.targetPlayerId = attacker.id;
    e.targetKind = attacker.targetKind;
    e.suspicion = 1.0;
    e.lastKnownX = attacker.x; e.lastKnownY = attacker.y;
    e.spottedPopTimer = STEALTH_TUNING.spottedPopDurationSec;
    return;
  }
  e.lastKnownX = attacker ? attacker.x : e.x - nx * 7.5;
  e.lastKnownY = attacker ? attacker.y : e.y - ny * 7.5;
}
