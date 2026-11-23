/** Multi-faction hostile target sensing, gradual suspicion fill, group/corpse alerting, and hit wakeup. */
import {
  AI_TUNING, STEALTH_TUNING, WorldChunkCache, canPerceiveTarget, hasElevationLineOfSight, isInSanctuary,
} from "@dc2d/engine";
import { clearNavPath } from "./creatureNavigation.js";
import type { CombatPlayerCandidate } from "./creatureBehaviors.js";
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

function canSeeCandidate(opts: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly cand: CombatTarget;
  readonly dist: number; readonly rangeMult: number; readonly visOverride?: number;
}): boolean {
  const spec = CREATURE_SPECS[opts.e.kind];
  const alertedFocus = opts.cand.targetKind === "player" || opts.e.targetPlayerId === opts.cand.id;
  if (alertedFocus && opts.e.alertedTimer > 0 && opts.dist <= spec.visionRange * 1.25) return true;
  if (opts.e.targetPlayerId === opts.cand.id && opts.dist <= spec.visionRange * 1.55) {
    return hasElevationLineOfSight({
      cache: opts.cache, fromX: opts.e.x, fromY: opts.e.y, fromElev: opts.e.elevation,
      toX: opts.cand.x, toY: opts.cand.y, toElev: opts.cand.elevation,
    });
  }
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
  readonly id: string; readonly players: readonly CombatPlayerCandidate[]; readonly allEntities: readonly WildlifeEntity[];
}): CombatTarget | null {
  const pl = opts.players.find((p) => p.id === opts.id && !isInSanctuary(p.x, p.y));
  if (pl) return { ...pl, targetKind: "player" };
  const ent = opts.allEntities.find((o) => o.id === opts.id && !o.corpse && o.hp > 0 && !isInSanctuary(o.x, o.y));
  return ent ? asEntityTarget(ent) : null;
}

function findBestPlayerTarget(opts: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly players: readonly CombatPlayerCandidate[];
}): { readonly target: CombatTarget; readonly dist: number } | null {
  let target: CombatTarget | null = null;
  let dist = Infinity;
  for (const p of opts.players) {
    const d = Math.hypot(p.x - opts.e.x, p.y - opts.e.y);
    const cand: CombatTarget = { ...p, targetKind: "player" };
    if (d < dist && !isInSanctuary(p.x, p.y) && canSeeCandidate({ cache: opts.cache, e: opts.e, cand, dist: d, rangeMult: 1 })) {
      dist = d; target = cand;
    }
  }
  return target ? { target, dist } : null;
}

function isEligibleHostileEntity(e: WildlifeEntity, o: WildlifeEntity): boolean {
  if (o.corpse || o.hp <= 0 || o.id === e.id || isInSanctuary(o.x, o.y)) return false;
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
  if (!isEligibleHostileEntity(e, o) || isCalmBehindWithPlayer(e, o, hasPlayer)) return null;
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

function hasInstantSuspicionLock(e: WildlifeEntity, perceived: CombatTarget, dist: number): boolean {
  const vis = perceived.visibility ?? 1;
  return e.targetPlayerId === perceived.id || e.alertedTimer > 0 || e.provokedTimer > 0
    || perceived.targetKind === "entity" || (dist <= 3.0 && vis >= 0.65);
}

function applySuspectState(e: WildlifeEntity, perceived: CombatTarget): void {
  e.aiState = ST_INVESTIGATE;
  e.lastKnownX = perceived.x; e.lastKnownY = perceived.y;
  e.investigateTimer = Math.max(e.investigateTimer, 4.5);
  const mag = Math.max(0.01, Math.hypot(perceived.x - e.x, perceived.y - e.y));
  e.facingX = (perceived.x - e.x) / mag; e.facingY = (perceived.y - e.y) / mag;
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

interface PeerNoticeCtx {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly o: WildlifeEntity; readonly dist: number;
}

function noticeCorpse(ctx: PeerNoticeCtx): boolean {
  const { cache, e, o, dist } = ctx;
  if (!o.corpse || dist > 6.5 || !hasLosToPeer(cache, e, o)) return false;
  e.suspicion = Math.max(e.suspicion, 0.65); e.aiState = ST_INVESTIGATE;
  e.lastKnownX = o.x; e.lastKnownY = o.y;
  e.investigateTimer = Math.max(e.investigateTimer, 6.0);
  return true;
}

function noticeBuddy(ctx: PeerNoticeCtx): boolean {
  const { cache, e, o, dist } = ctx;
  const social = SOCIAL_ALERT_FACTIONS.has(factionOfKind(e.kind)) || (e.packId !== null && e.packId === o.packId);
  if (!social || o.corpse || !o.targetPlayerId || dist > 9.0 || !hasLosToPeer(cache, e, o)) return false;
  e.targetPlayerId = o.targetPlayerId; e.targetKind = o.targetKind;
  e.lastKnownX = o.lastKnownX; e.lastKnownY = o.lastKnownY;
  e.suspicion = 1.0; e.alertedTimer = 5.0;
  return true;
}

function noticeCorpseOrBuddy(opts: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly o: WildlifeEntity;
  readonly allEntities: readonly WildlifeEntity[]; readonly players: readonly CombatPlayerCandidate[];
}): boolean {
  const ctx: PeerNoticeCtx = { cache: opts.cache, e: opts.e, o: opts.o, dist: Math.hypot(opts.o.x - opts.e.x, opts.o.y - opts.e.y) };
  return noticeCorpse(ctx) || noticeBuddy(ctx);
}

export function scanAlliesAndCorpses(opts: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity;
  readonly allEntities: readonly WildlifeEntity[]; readonly players: readonly CombatPlayerCandidate[];
}): void {
  const { e, allEntities } = opts;
  if (e.targetPlayerId !== null || e.aiState === ST_RETURN) return;
  const myFaction = factionOfKind(e.kind);
  for (const o of allEntities) {
    if (o.id === e.id || factionOfKind(o.kind) !== myFaction) continue;
    if (noticeCorpseOrBuddy({ ...opts, o })) return;
  }
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
  e.investigateTimer = Math.max(e.investigateTimer, 7.5);
  e.aiState = ST_INVESTIGATE;
  e.facingX = -nx; e.facingY = -ny;
  clearNavPath(e);
  const attacker = resolveLockedTarget({ id: actorId, players, allEntities });
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
