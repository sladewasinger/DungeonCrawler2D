import type {
  EnemySearchPoint,
  EnemySearchState,
} from "../../../state/enemyState.js";
import type { EnemySearchCandidate } from "./enemySearchCandidates.js";
import {
  nextReachableSearchCandidate,
} from "./enemySearchCandidateScan.js";
import type { EnemySearchDirection } from "./enemySearchObservation.js";

interface SearchAdvanceInput {
  readonly state: EnemySearchState;
  readonly position: { readonly x: number; readonly y: number };
  readonly candidates: readonly EnemySearchCandidate[];
  readonly arrivalTolerance: number;
  readonly waypointPauseTicks: number;
  readonly groundAt: (x: number, y: number) => number;
  readonly isReachable: (point: EnemySearchPoint) => boolean;
}

export interface EnemySearchAdvance {
  readonly state: EnemySearchState;
  readonly target?: EnemySearchPoint;
  readonly selectedWaypoint: boolean;
}

export function createEnemySearchState(
  anchor: EnemySearchPoint,
  pauseTicks: number,
  forward?: EnemySearchDirection,
): EnemySearchState {
  return {
    anchor,
    visitedWaypointKeys: [searchPointKey(anchor)],
    candidateCursor: 0,
    pauseTicksRemaining: Math.max(0, pauseTicks),
    ...(forward ? { forward } : {}),
  };
}

export function advanceEnemySearchState(
  input: SearchAdvanceInput,
): EnemySearchAdvance {
  const arrived = arrivedAtWaypoint(input);
  if (arrived) return pauseAfterArrival(input);
  if (input.state.waypoint) {
    return currentWaypoint(input.state, input.state.waypoint);
  }
  if (input.state.pauseTicksRemaining > 0) {
    return continueSearchPause(input.state);
  }
  return selectNextWaypoint(input);
}

export function rejectEnemySearchWaypointState(
  state: EnemySearchState,
): EnemySearchState {
  return stateWithoutWaypoint(state, 0);
}

function arrivedAtWaypoint(input: SearchAdvanceInput): boolean {
  const waypoint = input.state.waypoint;
  return waypoint !== undefined &&
    Math.hypot(
      waypoint.x - input.position.x,
      waypoint.y - input.position.y,
    ) <= input.arrivalTolerance;
}

function pauseAfterArrival(input: SearchAdvanceInput): EnemySearchAdvance {
  const pauseTicks = Math.max(0, input.waypointPauseTicks);
  const state = stateWithoutWaypoint(input.state, pauseTicks);
  if (pauseTicks === 0) {
    return selectNextWaypoint({ ...input, state });
  }
  return {
    state,
    selectedWaypoint: false,
  };
}

function currentWaypoint(
  state: EnemySearchState,
  target: EnemySearchPoint,
): EnemySearchAdvance {
  return {
    state,
    target,
    selectedWaypoint: false,
  };
}

function stateWithoutWaypoint(
  state: EnemySearchState,
  pauseTicksRemaining: number,
): EnemySearchState {
  return {
    anchor: state.anchor,
    visitedWaypointKeys: state.visitedWaypointKeys,
    candidateCursor: state.candidateCursor,
    pauseTicksRemaining,
    ...(state.forward ? { forward: state.forward } : {}),
  };
}

function continueSearchPause(state: EnemySearchState): EnemySearchAdvance {
  return {
    state: {
      ...state,
      pauseTicksRemaining: state.pauseTicksRemaining - 1,
    },
    selectedWaypoint: false,
  };
}

function selectNextWaypoint(
  input: SearchAdvanceInput,
): EnemySearchAdvance {
  const selection = nextReachableSearchCandidate({
    candidateCursor: input.state.candidateCursor,
    candidates: input.candidates,
    visitedWaypointKeys: input.state.visitedWaypointKeys,
    groundAt: input.groundAt,
    isReachable: input.isReachable,
  });
  const state = { ...input.state, candidateCursor: selection.nextCursor };
  if (!selection.point) {
    return { state, selectedWaypoint: false };
  }
  return {
    state: {
      ...state,
      waypoint: selection.point,
      visitedWaypointKeys: [
        ...state.visitedWaypointKeys,
        searchPointKey(selection.point),
      ],
    },
    target: selection.point,
    selectedWaypoint: true,
  };
}

export function searchPointKey(
  point: { readonly x: number; readonly y: number },
): string {
  return `${Math.floor(point.x)},${Math.floor(point.y)}`;
}
