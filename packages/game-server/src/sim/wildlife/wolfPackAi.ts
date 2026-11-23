/** Wolf pack hive-mind rally, organic jittered encirclement, and behind-facing dart bites. */
import { STEALTH_TUNING, computeFlankRingSlot, hashUnit2d, isBackstabAngle, type WorldEvent } from "@dc2d/engine";
import { CREATURE_SPECS, ST_CHASE, ST_FLANK, ST_RETURN, type WildlifeEntity } from "./creatureSpecs.js";
import type { CombatPlayerCandidate, SteerTarget, StrikePlayerFn } from "./creatureBehaviors.js";

const WOLF_RALLY_RADIUS = 18.0;

function isRallyCandidate(w: WildlifeEntity, source: WildlifeEntity): boolean {
  if (w.corpse || w.hp <= 0 || w.kind !== "wolf" || w.id === source.id) return false;
  if (w.aiState === ST_RETURN || w.targetPlayerId === source.targetPlayerId) return false;
  return Math.hypot(w.x - source.x, w.y - source.y) <= WOLF_RALLY_RADIUS;
}

function rallySingleWolf(w: WildlifeEntity, source: WildlifeEntity, events: WorldEvent[]): void {
  w.targetPlayerId = source.targetPlayerId;
  w.lastKnownX = source.lastKnownX;
  w.lastKnownY = source.lastKnownY;
  w.investigateTimer = 6.0;
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

function resolvePackPeers(e: WildlifeEntity, targetId: string, entities: readonly WildlifeEntity[]): readonly WildlifeEntity[] {
  const peers = entities.filter((m) => m.hp > 0 && !m.corpse && m.kind === "wolf" && (m.targetPlayerId === targetId || (m.packId !== null && m.packId === e.packId)));
  peers.sort((a, b) => a.id.localeCompare(b.id));
  return peers;
}

function facingOf(target: CombatPlayerCandidate): { readonly x: number; readonly y: number } {
  return { x: target.facingX ?? 0, y: target.facingY ?? 1 };
}

function applyDartStrike(opts: {
  readonly e: WildlifeEntity; readonly target: CombatPlayerCandidate; readonly behind: boolean; readonly onStrike: StrikePlayerFn;
}): void {
  opts.onStrike(opts.e, opts.target);
  if (opts.behind) opts.e.peelTimer = 0.85;
}

function tryDartBite(opts: {
  readonly e: WildlifeEntity; readonly target: CombatPlayerCandidate; readonly dist: number; readonly onStrike: StrikePlayerFn;
}): SteerTarget | null {
  const { e, target, dist, onStrike } = opts;
  if (e.attackCooldown > 0) return null;
  const spec = CREATURE_SPECS.wolf;
  const behind = isBackstabAngle({ attacker: e, target, targetFacing: facingOf(target) });
  if (dist > (behind ? 3.6 : spec.range + 0.35)) return null;
  if (dist <= spec.range) applyDartStrike({ e, target, behind, onStrike });
  e.aiState = ST_CHASE;
  return { x: target.x, y: target.y, speedMult: behind ? 1.28 : 1.15 };
}

export function stepWolfHiveMind(opts: {
  readonly e: WildlifeEntity; readonly target: CombatPlayerCandidate;
  readonly entities: readonly WildlifeEntity[]; readonly timeSec: number; readonly onStrike: StrikePlayerFn;
}): SteerTarget {
  const { e, target, entities, timeSec, onStrike } = opts;
  const dist = Math.hypot(target.x - e.x, target.y - e.y);
  if (e.peelTimer <= 0) { const dart = tryDartBite({ e, target, dist, onStrike }); if (dart) return dart; }
  const peers = resolvePackPeers(e, target.id, entities);
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