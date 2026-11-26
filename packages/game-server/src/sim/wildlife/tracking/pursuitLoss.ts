/** Unseen target handling, short LOS grace, pursuit momentum drop, and audio search redirection. */
import { WorldChunkCache, isInWorldSanctuary } from "@dc2d/engine";
import { CREATURE_SPECS, ST_CHASE, type WildlifeEntity } from "../creatureSpecs.js";
import { moveCreatureToward, type CombatPlayerCandidate } from "../creatureBehaviors.js";
import { findHeardHostilePlayer, resolveLockedTarget, type CombatTarget } from "../factionTargeting.js";
import { beginInvestigation, projectPursuitMomentum } from "./searchTracking.js";

export interface UnseenTurnInput {
  readonly cache: WorldChunkCache;
  readonly e: WildlifeEntity;
  readonly allEntities: readonly WildlifeEntity[];
  readonly players: readonly CombatPlayerCandidate[];
  readonly dt: number;
  readonly enterReturn: (e: WildlifeEntity) => void;
}

export function resetHuntTracking(e: WildlifeEntity): void {
  e.huntedTargetId = null; e.huntedTargetKind = null;
  e.losGraceTimer = 0; e.lastScentSeq = 0;
  e.scentTrackTimer = 0; e.scentHuntElapsed = 0; e.investigateElapsed = 0;
  e.coldTrailSearchDone = false; e.searchStepCount = 0;
}

export function recordTargetPursuitState(e: WildlifeEntity, target: CombatTarget, dt: number): void {
  const mvDx = target.x - e.lastKnownX;
  const mvDy = target.y - e.lastKnownY;
  const mvDist = Math.hypot(mvDx, mvDy);
  if (dt > 0 && mvDist > 0.02) {
    e.lastSeenDirX = mvDx / mvDist;
    e.lastSeenDirY = mvDy / mvDist;
    e.lastSeenSpeed = mvDist / dt;
  } else {
    e.lastSeenSpeed *= 0.7;
  }
  e.huntedTargetId = target.id; e.huntedTargetKind = target.targetKind;
  e.scentHuntElapsed = 0; e.investigateElapsed = 0; e.scentTrackTimer = 0;
  e.coldTrailSearchDone = false; e.searchStepCount = 0;
  e.lastKnownX = target.x; e.lastKnownY = target.y;
  e.investigateTimer = CREATURE_SPECS[e.kind].sensory.postChaseSearchSec;
}

function dropPursuitToSearch(input: UnseenTurnInput): void {
  const { cache, e } = input;
  const spec = CREATURE_SPECS[e.kind];
  const projected = projectPursuitMomentum({
    cache, from: e, lastKnown: { x: e.lastKnownX, y: e.lastKnownY },
    dirX: e.lastSeenDirX, dirY: e.lastSeenDirY, speed: e.lastSeenSpeed,
  });
  e.huntedTargetId = e.targetPlayerId; e.huntedTargetKind = e.targetKind;
  e.targetPlayerId = null; e.targetKind = null;
  e.scentHuntElapsed = 0; e.investigateElapsed = 0; e.lastScentSeq = 0;
  e.coldTrailSearchDone = false; e.searchStepCount = 0;
  beginInvestigation({
    cache, e, x: projected.x, y: projected.y,
    durationSec: spec.sensory.postChaseSearchSec, minSuspicion: 0.85, preserveScentSeq: true,
  });
}

function isTargetSafeOrGone(input: UnseenTurnInput): boolean {
  const { e, players, allEntities, enterReturn } = input;
  if (!e.targetPlayerId || resolveLockedTarget({ id: e.targetPlayerId, players, allEntities, cache: input.cache })) return false;
  if (e.targetKind === "player" && players.some((p) => p.id === e.targetPlayerId && isInWorldSanctuary(input.cache, p.x, p.y))) {
    enterReturn(e);
    return true;
  }
  e.losGraceTimer = 0;
  return false;
}

function refreshTargetByHearing(input: UnseenTurnInput): void {
  const heard = findHeardHostilePlayer({ cache: input.cache, e: input.e, players: input.players });
  if (heard && heard.id === input.e.targetPlayerId) {
    input.e.lastKnownX = heard.x;
    input.e.lastKnownY = heard.y;
  }
}

export function stepLostSightGrace(input: UnseenTurnInput): boolean {
  const { cache, e, dt, enterReturn } = input;
  if (e.targetPlayerId === null) return false;
  if (e.kind === "wolf" && e.hp < e.maxHp * 0.25) { enterReturn(e); return true; }
  if (isTargetSafeOrGone(input)) return true;
  refreshTargetByHearing(input);
  if (e.losGraceTimer <= 0) { dropPursuitToSearch(input); return false; }
  e.losGraceTimer = Math.max(0, e.losGraceTimer - dt);
  e.aiState = ST_CHASE;
  moveCreatureToward({ cache, e, tx: e.lastKnownX, ty: e.lastKnownY, speed: CREATURE_SPECS[e.kind].speed, dt });
  return true;
}

export function redirectSearchByHearing(input: UnseenTurnInput): void {
  const { cache, e, players } = input;
  if (e.investigateTimer <= 0) return;
  const heard = findHeardHostilePlayer({ cache, e, players });
  if (!heard) return;
  const shifted = Math.hypot(heard.x - e.lastKnownX, heard.y - e.lastKnownY) > 0.65;
  if (!shifted && e.searchPhase === "move_to_clue") return;
  e.huntedTargetId = heard.id;
  e.huntedTargetKind = "player";
  beginInvestigation({
    cache, e, x: heard.x, y: heard.y,
    durationSec: CREATURE_SPECS[e.kind].sensory.searchDurationSec, minSuspicion: 0.78, preserveScentSeq: true,
  });
}
