/** Structured 3-phase investigation, pursuit momentum projection, and animal scent following. */
import { AI_TUNING, GroundKind, WorldChunkCache, findTilePath, isInWorldSanctuary } from "@dc2d/engine";
import { CREATURE_SPECS, ST_INVESTIGATE, type SearchPhase, type WildlifeEntity } from "../creatureSpecs.js";
import { clearNavPath, isClearSpot, moveCreatureToward } from "../creatureNavigation.js";
import type { ScentTrail } from "../scentTrail.js";

const PHASE_CLUE: SearchPhase = "move_to_clue";
const PHASE_SCAN: SearchPhase = "scan";
const PHASE_AREA: SearchPhase = "search_area";

const CLUE_OFFSETS = [0, 0.78, -0.78, 1.57, -1.57, 2.35, -2.35, Math.PI] as const;
const WAYPOINT_DISTS = [2.8, 2.2, 3.4] as const;
const COLD_WAYPOINT_DISTS = [3.4, 4.8, 2.4] as const;
const WAYPOINT_OFFSETS = [0, 0.65, -0.65, 1.35] as const;
const BANK_CROSS_DISTS = [3.2, 4.2, 5.2, 6.2, 7.2] as const;
const BANK_CROSS_OFFSETS = [0, 0.35, -0.35] as const;

export interface Pt2 {
  readonly x: number;
  readonly y: number;
}

function isWalkableClueSpot(cache: WorldChunkCache, baseElev: number, pt: Pt2): boolean {
  if (isInWorldSanctuary(cache, pt.x, pt.y)) return false;
  const tile = cache.tileAt(Math.floor(pt.x), Math.floor(pt.y));
  if (tile.ground === GroundKind.DeepWater || Math.abs(tile.elevation - baseElev) > 1) return false;
  return isClearSpot(cache, { x: pt.x, y: pt.y, pad: 0.34 });
}

function snapToClearClue(cache: WorldChunkCache, origin: Pt2, raw: Pt2): Pt2 {
  const baseElev = cache.tileAt(Math.floor(origin.x), Math.floor(origin.y)).elevation;
  if (isWalkableClueSpot(cache, baseElev, raw)) return raw;
  const baseAng = Math.atan2(origin.y - raw.y, origin.x - raw.x);
  for (const r of [0.65, 1.15]) {
    for (const off of CLUE_OFFSETS) {
      const cand = { x: raw.x + Math.cos(baseAng + off) * r, y: raw.y + Math.sin(baseAng + off) * r };
      if (isWalkableClueSpot(cache, baseElev, cand)) return cand;
    }
  }
  return raw;
}

export function projectPursuitMomentum(opts: {
  readonly cache: WorldChunkCache; readonly from: Pt2; readonly lastKnown: Pt2;
  readonly dirX: number; readonly dirY: number; readonly speed: number;
}): Pt2 {
  const dirMag = Math.hypot(opts.dirX, opts.dirY);
  if (opts.speed < 0.4 || dirMag < 0.1) return snapToClearClue(opts.cache, opts.from, opts.lastKnown);
  const nx = opts.dirX / dirMag;
  const ny = opts.dirY / dirMag;
  const startElev = opts.cache.tileAt(Math.floor(opts.lastKnown.x), Math.floor(opts.lastKnown.y)).elevation;
  let best = opts.lastKnown;
  for (let d = 0.55; d <= 2.25; d += 0.55) {
    const pt = { x: opts.lastKnown.x + nx * d, y: opts.lastKnown.y + ny * d };
    if (!isWalkableClueSpot(opts.cache, startElev, pt)) break;
    best = pt;
  }
  return snapToClearClue(opts.cache, opts.from, best);
}

export function beginInvestigation(opts: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity;
  readonly x: number; readonly y: number; readonly durationSec: number;
  readonly minSuspicion?: number | undefined; readonly preserveScentSeq?: boolean | undefined;
}): void {
  const { cache, e } = opts;
  const clear = snapToClearClue(cache, e, { x: opts.x, y: opts.y });
  e.lastKnownX = clear.x;
  e.lastKnownY = clear.y;
  e.aiState = ST_INVESTIGATE;
  e.searchPhase = PHASE_CLUE;
  e.searchPhaseTimer = 0;
  e.investigateTimer = Math.max(e.investigateTimer, opts.durationSec);
  e.searchAnchorAngle = Math.atan2(clear.y - e.y, clear.x - e.x);
  if (opts.minSuspicion !== undefined) e.suspicion = Math.max(e.suspicion, opts.minSuspicion);
  if (opts.preserveScentSeq === false) e.lastScentSeq = 0;
  clearNavPath(e);
}

export function tryFollowAnimalScent(opts: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly scent: ScentTrail;
}): boolean {
  const { cache, e, scent } = opts;
  const { sensory } = CREATURE_SPECS[e.kind];
  const capSec = sensory.scentPatienceCapSec + (e.coldTrailSearchDone ? 6.0 : 0);
  if (sensory.scentRadius <= 0 || e.scentHuntElapsed >= capSec) return false;
  const crumb = scent.findNextTrailCrumb({
    x: e.x, y: e.y, elevation: e.elevation, maxDist: sensory.scentRadius,
    maxAgeSec: sensory.scentMaxAgeSec, actorId: e.huntedTargetId, minSeq: e.lastScentSeq,
  });
  if (!crumb) return false;
  e.lastScentSeq = crumb.seq;
  e.huntedTargetId = crumb.actorId;
  e.huntedTargetKind = "player";
  e.scentTrackTimer = 2.6;
  e.suspicion = Math.max(e.suspicion, 0.72);
  const rem = Math.max(0, capSec - e.scentHuntElapsed);
  e.investigateTimer = Math.max(e.investigateTimer, Math.min(rem, 4.8));
  const clear = snapToClearClue(cache, e, { x: crumb.x, y: crumb.y });
  e.lastKnownX = clear.x; e.lastKnownY = clear.y;
  e.searchPhase = PHASE_CLUE;
  e.searchAnchorAngle = Math.atan2(clear.y - e.y, clear.x - e.x);
  clearNavPath(e);
  return true;
}

const isWaterGround = (ground: GroundKind): boolean =>
  ground === GroundKind.ShallowWater || ground === GroundKind.DeepWater;

function hasWaterAhead(cache: WorldChunkCache, e: WildlifeEntity): boolean {
  for (const d of [1.2, 1.8, 2.5, 3.2]) {
    const tx = Math.floor(e.x + Math.cos(e.searchAnchorAngle) * d);
    const ty = Math.floor(e.y + Math.sin(e.searchAnchorAngle) * d);
    if (isWaterGround(cache.tileAt(tx, ty).ground)) return true;
  }
  return false;
}

function isValidSearchWaypoint(cache: WorldChunkCache, e: WildlifeEntity, cand: Pt2): boolean {
  if (Math.hypot(cand.x - e.x, cand.y - e.y) < 1.0) return false;
  if (CREATURE_SPECS[e.kind].territorialGuard && Math.hypot(cand.x - e.homeX, cand.y - e.homeY) > e.homeRadius * 1.35) {
    return false;
  }
  return isWalkableClueSpot(cache, e.elevation, cand);
}

function findBankAtDist(cache: WorldChunkCache, e: WildlifeEntity, dist: number): Pt2 | null {
  for (const off of BANK_CROSS_OFFSETS) {
    const ang = e.searchAnchorAngle + off;
    const cand = { x: e.x + Math.cos(ang) * dist, y: e.y + Math.sin(ang) * dist };
    if (isWaterGround(cache.tileAt(Math.floor(cand.x), Math.floor(cand.y)).ground)) continue;
    if (!isValidSearchWaypoint(cache, e, cand)) continue;
    if (findTilePath({ cache, startX: e.x, startY: e.y, goalX: cand.x, goalY: cand.y, maxRadiusTiles: 12 }).reachedGoal) return cand;
  }
  return null;
}

function findAcrossWaterBank(cache: WorldChunkCache, e: WildlifeEntity): Pt2 | null {
  const noScent = CREATURE_SPECS[e.kind].sensory.scentRadius <= 0 || e.lastScentSeq <= 0;
  if (noScent || e.searchStepCount > 2 || !hasWaterAhead(cache, e)) return null;
  for (const dist of BANK_CROSS_DISTS) {
    const hit = findBankAtDist(cache, e, dist);
    if (hit) return hit;
  }
  return null;
}

function pickAreaWaypoint(cache: WorldChunkCache, e: WildlifeEntity): Pt2 {
  const side = e.peekSide;
  e.peekSide = -side;
  const baseAng = e.searchAnchorAngle + side * (0.85 + (e.searchStepCount % 3) * 0.55);
  const dists = e.coldTrailSearchDone ? COLD_WAYPOINT_DISTS : WAYPOINT_DISTS;
  for (const dist of dists) {
    for (const off of WAYPOINT_OFFSETS) {
      const ang = baseAng + off * side;
      const cand = { x: e.lastKnownX + Math.cos(ang) * dist, y: e.lastKnownY + Math.sin(ang) * dist };
      if (isValidSearchWaypoint(cache, e, cand)) return cand;
    }
  }
  return { x: e.lastKnownX, y: e.lastKnownY };
}

function pickSearchWaypoint(cache: WorldChunkCache, e: WildlifeEntity): Pt2 {
  e.searchStepCount += 1;
  return findAcrossWaterBank(cache, e) ?? pickAreaWaypoint(cache, e);
}

function enterScanPhase(e: WildlifeEntity, duration: number): void {
  e.searchPhase = PHASE_SCAN;
  e.searchPhaseTimer = duration;
  e.searchAnchorAngle = Math.atan2(e.facingY, e.facingX);
  clearNavPath(e);
}

function stepMoveToClue(opts: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly scent: ScentTrail; readonly dt: number;
}): void {
  const { cache, e, dt } = opts;
  const dist = Math.hypot(e.lastKnownX - e.x, e.lastKnownY - e.y);
  if (CREATURE_SPECS[e.kind].sensory.scentRadius > 0 && dist <= 1.35 && tryFollowAnimalScent(opts)) return;
  if (dist <= 0.65 || (!e.navReachedGoal && dist <= 1.35)) {
    enterScanPhase(e, 1.35);
    return;
  }
  const speedMult = e.scentTrackTimer > 0 ? 0.85 : 0.78;
  moveCreatureToward({ cache, e, tx: e.lastKnownX, ty: e.lastKnownY, speed: CREATURE_SPECS[e.kind].speed * speedMult, dt });
}

function triggerColdTrailSearch(e: WildlifeEntity): void {
  if (CREATURE_SPECS[e.kind].sensory.scentRadius <= 0 || e.lastScentSeq <= 0 || e.coldTrailSearchDone) return;
  e.coldTrailSearchDone = true;
  e.investigateTimer = Math.max(e.investigateTimer, AI_TUNING.coldTrailSearchSec);
  e.scentTrackTimer = 0;
}

function stepScanPhase(opts: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly scent: ScentTrail; readonly dt: number;
}): void {
  const { cache, e, dt } = opts;
  e.searchPhaseTimer = Math.max(0, e.searchPhaseTimer - dt);
  const sweep = Math.sin((1.35 - e.searchPhaseTimer) * 3.8) * 0.95;
  e.facingX = Math.cos(e.searchAnchorAngle + sweep);
  e.facingY = Math.sin(e.searchAnchorAngle + sweep);
  if (tryFollowAnimalScent(opts)) return;
  if (e.searchPhaseTimer > 0) return;
  triggerColdTrailSearch(e);
  const wp = pickSearchWaypoint(cache, e);
  e.searchPointX = wp.x;
  e.searchPointY = wp.y;
  e.searchPhase = PHASE_AREA;
  clearNavPath(e);
}

function stepSearchAreaPhase(opts: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly scent: ScentTrail; readonly dt: number;
}): void {
  const { cache, e, dt } = opts;
  if (tryFollowAnimalScent(opts)) return;
  const dist = Math.hypot(e.searchPointX - e.x, e.searchPointY - e.y);
  if (dist <= 0.55 || (!e.navReachedGoal && dist <= 1.15)) {
    enterScanPhase(e, 1.2);
    return;
  }
  moveCreatureToward({ cache, e, tx: e.searchPointX, ty: e.searchPointY, speed: CREATURE_SPECS[e.kind].speed * 0.62, dt });
}

export function stepStructuredInvestigation(opts: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly scent: ScentTrail; readonly dt: number;
}): void {
  const { e, dt } = opts;
  e.investigateElapsed += dt;
  const countScent = CREATURE_SPECS[e.kind].sensory.scentRadius > 0 && (!e.coldTrailSearchDone || e.scentTrackTimer > 0);
  if (countScent) e.scentHuntElapsed += dt;
  if (e.searchPhase === PHASE_SCAN) { stepScanPhase(opts); return; }
  if (e.searchPhase === PHASE_AREA) { stepSearchAreaPhase(opts); return; }
  stepMoveToClue(opts);
}

export function tryHungryPassiveScentWhiff(opts: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly scent: ScentTrail; readonly dt: number;
}): boolean {
  const { cache, e, scent, dt } = opts;
  const spec = CREATURE_SPECS[e.kind];
  if (spec.sensory.scentRadius <= 0) return false;
  if (!spec.scavenger) e.hunger = Math.min(1, e.hunger + dt * 0.025);
  if (e.hunger < 0.55 || e.passiveSniffCooldown > 0) return false;
  const crumb = scent.findFreshPassiveWhiff({ x: e.x, y: e.y, elevation: e.elevation, maxDist: 2.4, maxAgeSec: 5.0 });
  if (!crumb) return false;
  e.passiveSniffCooldown = 4.5;
  e.huntedTargetId = crumb.actorId;
  e.huntedTargetKind = "player";
  e.lastScentSeq = crumb.seq;
  e.scentTrackTimer = 2.6;
  e.scentHuntElapsed = 0;
  e.investigateElapsed = 0;
  beginInvestigation({
    cache, e, x: crumb.x, y: crumb.y,
    durationSec: spec.sensory.searchDurationSec, minSuspicion: 0.45, preserveScentSeq: true,
  });
  return true;
}
