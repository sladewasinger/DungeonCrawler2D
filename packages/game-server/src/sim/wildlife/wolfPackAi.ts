/** Wolf pack hive-mind rally, organic jittered encirclement, lone-flee, campfire wariness, and dart bites. */
import { PropKind, STEALTH_TUNING, WorldChunkCache, computeFlankRingSlot, hashUnit2d, isBackstabAngle, type WorldEvent } from "@dc2d/engine";
import { CREATURE_SPECS, ST_ALERT, ST_CHASE, ST_FLANK, ST_RETURN, type WildlifeEntity } from "./creatureSpecs.js";
import type { CombatTarget } from "./factionTargeting.js";
import type { CombatPlayerCandidate, SteerTarget, StrikePlayerFn } from "./creatureBehaviors.js";

const WOLF_RALLY_RADIUS = 18.0;

function isRallyCandidate(w: WildlifeEntity, source: WildlifeEntity): boolean {
  if (w.corpse || w.hp <= 0 || w.kind !== "wolf" || w.id === source.id) return false;
  if (w.aiState === ST_RETURN || w.targetPlayerId === source.targetPlayerId) return false;
  return Math.hypot(w.x - source.x, w.y - source.y) <= WOLF_RALLY_RADIUS;
}

function rallySingleWolf(w: WildlifeEntity, source: WildlifeEntity, events: WorldEvent[]): void {
  w.targetPlayerId = source.targetPlayerId;
  w.targetKind = source.targetKind;
  w.suspicion = 1.0;
  w.howlDone = true;
  w.lastKnownX = source.lastKnownX;
  w.lastKnownY = source.lastKnownY;
  w.investigateTimer = 6.0;
  w.alertedTimer = Math.max(w.alertedTimer, 6.0);
  w.spottedPopTimer = STEALTH_TUNING.spottedPopDurationSec * 0.75;
  if (w.vocalCooldown > 0) return;
  w.vocalCooldown = 4.0;
  events.push({ kind: "creatureVocal", x: w.x, y: w.y, actorId: w.id, entityKind: w.kind, vocalKind: "alert" });
}

export function rallyWolfPack(opts: {
  readonly source: WildlifeEntity;
  readonly entities: readonly WildlifeEntity[];
  readonly events: WorldEvent[];
}): void {
  if (opts.source.kind !== "wolf" || !opts.source.targetPlayerId) return;
  for (const w of opts.entities) {
    if (isRallyCandidate(w, opts.source)) rallySingleWolf(w, opts.source, opts.events);
  }
}

export function triggerWolfSpotHowl(opts: {
  readonly e: WildlifeEntity; readonly entities: readonly WildlifeEntity[]; readonly events: WorldEvent[];
}): boolean {
  const { e, entities, events } = opts;
  if (e.kind !== "wolf" || e.howlDone) return false;
  e.howlDone = true;
  const hasPackMate = entities.some((o) => isRallyCandidate(o, e));
  const peerHowling = entities.some((o) => o.kind === "wolf" && o.packId === e.packId && o.howlTimer > 0);
  if (!hasPackMate || peerHowling) { rallyWolfPack({ source: e, entities, events }); return false; }
  e.howlTimer = 0.65; e.aiState = ST_ALERT;
  events.push({ kind: "wolfHowl", x: e.x, y: e.y, actorId: e.id, entityKind: e.kind });
  return true;
}

function resolvePackPeers(e: WildlifeEntity, targetId: string, entities: readonly WildlifeEntity[]): readonly WildlifeEntity[] {
  const peers = entities.filter((m) => m.hp > 0 && !m.corpse && m.kind === "wolf" && (m.targetPlayerId === targetId || (m.packId !== null && m.packId === e.packId)));
  peers.sort((a, b) => a.id.localeCompare(b.id));
  return peers;
}

function facingOf(target: CombatPlayerCandidate): { readonly x: number; readonly y: number } {
  return { x: target.facingX ?? 0, y: target.facingY ?? 1 };
}

function tryDartBite(opts: {
  readonly e: WildlifeEntity; readonly target: CombatPlayerCandidate; readonly dist: number; readonly onStrike: StrikePlayerFn;
}): SteerTarget | null {
  const { e, target, dist, onStrike } = opts;
  if (e.attackCooldown > 0) return null;
  const spec = CREATURE_SPECS.wolf;
  const behind = isBackstabAngle({ attacker: e, target, targetFacing: facingOf(target) });
  if (dist > (behind ? 3.6 : spec.range + 0.35)) return null;
  if (dist <= spec.range) { onStrike(e, target); if (behind) e.peelTimer = 0.85; }
  e.aiState = ST_CHASE;
  return { x: target.x, y: target.y, speedMult: behind ? 1.28 : 1.15 };
}

function steerAwayFromCampfire(cache: WorldChunkCache, e: WildlifeEntity): SteerTarget | null {
  if (e.provokedTimer > 0) return null;
  const fire = cache.propsNear(e.x, e.y).find((p) => p.kind === PropKind.Campfire && Math.hypot(p.x - e.x, p.y - e.y) <= 3.5);
  if (!fire) return null;
  const dx = e.x - fire.x; const dy = e.y - fire.y;
  const mag = Math.max(0.01, Math.hypot(dx, dy));
  return { x: fire.x + (dx / mag) * 4.5, y: fire.y + (dy / mag) * 4.5, speedMult: 0.9 };
}

function steerAwayOrFlee(opts: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly target: CombatTarget; readonly peers: readonly WildlifeEntity[];
}): SteerTarget | null {
  if (opts.peers.length <= 1 && opts.e.hp < opts.e.maxHp * 0.25) {
    opts.e.aiState = ST_RETURN;
    opts.e.investigateTimer = 0;
    return { x: opts.e.x + (opts.e.x - opts.target.x) * 2.5, y: opts.e.y + (opts.e.y - opts.target.y) * 2.5, speedMult: 1.25 };
  }
  const fireAvoid = steerAwayFromCampfire(opts.cache, opts.e);
  if (fireAvoid) opts.e.aiState = ST_FLANK;
  return fireAvoid;
}

export function stepWolfHiveMind(opts: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly target: CombatTarget;
  readonly entities: readonly WildlifeEntity[]; readonly timeSec: number; readonly onStrike: StrikePlayerFn;
}): SteerTarget {
  const { cache, e, target, entities, timeSec, onStrike } = opts;
  const peers = resolvePackPeers(e, target.id, entities);
  const special = steerAwayOrFlee({ cache, e, target, peers });
  if (special) return special;
  const dist = Math.hypot(target.x - e.x, target.y - e.y);
  if (e.peelTimer <= 0) { const dart = tryDartBite({ e, target, dist, onStrike }); if (dart) return dart; }
  const slotIdx = Math.max(0, peers.indexOf(e));
  const jSeed = e.packSlot * 37 + Math.round(e.homeX + e.homeY);
  const radJitter = (hashUnit2d(jSeed, slotIdx, 1) - 0.5) * 0.65;
  const angJitter = (hashUnit2d(jSeed, slotIdx, 2) - 0.5) * 0.55;
  const ringRadius = (e.peelTimer > 0 ? 2.95 : 2.05) + radJitter;
  e.aiState = ST_FLANK;
  const ring = computeFlankRingSlot({
    centerX: target.x, centerY: target.y, slotIndex: slotIdx,
    packSize: Math.max(1, peers.length), ringRadius, phaseRad: timeSec * 0.42 + angJitter,
  });
  return { x: ring.x, y: ring.y, speedMult: e.peelTimer > 0 ? 1.18 : 1.0 };
}
