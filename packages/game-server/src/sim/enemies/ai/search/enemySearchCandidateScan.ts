import type { EnemySearchPoint } from "../../../state/enemyState.js";
import type { EnemySearchCandidate } from "./enemySearchCandidates.js";

const MAX_WAYPOINT_SELECTION_ATTEMPTS = 8;

export interface ReachableSearchCandidateRequest {
  readonly candidateCursor: number;
  readonly candidates: readonly EnemySearchCandidate[];
  readonly visitedWaypointKeys: readonly string[];
  readonly groundAt: (x: number, y: number) => number;
  readonly isReachable: (point: EnemySearchPoint) => boolean;
}

export interface ReachableSearchCandidate {
  readonly point?: EnemySearchPoint;
  readonly nextCursor: number;
}

/** Skips unusable search points without allowing unbounded path work per tick. */
export function nextReachableSearchCandidate(
  request: ReachableSearchCandidateRequest,
): ReachableSearchCandidate {
  const limit = Math.min(
    request.candidates.length,
    request.candidateCursor + MAX_WAYPOINT_SELECTION_ATTEMPTS,
  );
  for (let cursor = request.candidateCursor; cursor < limit; cursor++) {
    const point = reachablePointAt(request, cursor);
    if (point) return { point, nextCursor: cursor + 1 };
  }
  return { nextCursor: limit };
}

function reachablePointAt(
  request: ReachableSearchCandidateRequest,
  index: number,
): EnemySearchPoint | undefined {
  const candidate = request.candidates[index];
  if (!candidate || request.visitedWaypointKeys.includes(
    searchCandidateKey(candidate),
  )) return undefined;
  const point = {
    ...candidate,
    z: request.groundAt(candidate.x, candidate.y),
  };
  return request.isReachable(point) ? point : undefined;
}

function searchCandidateKey(
  point: { readonly x: number; readonly y: number },
): string {
  return `${Math.floor(point.x)},${Math.floor(point.y)}`;
}
