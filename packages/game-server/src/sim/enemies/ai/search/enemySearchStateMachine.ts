import type {
  EnemySearchPoint,
  EnemySearchState,
} from "../../../state/enemyState.js";
import type { EnemySearchCandidate } from "./enemySearchCandidates.js";

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
): EnemySearchState {
  return {
    anchor,
    visitedWaypointKeys: [searchPointKey(anchor)],
    candidateCursor: 0,
    pauseTicksRemaining: Math.max(0, pauseTicks),
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
  return {
    state: stateWithoutWaypoint(
      input.state,
      Math.max(0, input.waypointPauseTicks),
    ),
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
  const selection = nextUnvisitedCandidate(input);
  if (!selection) {
    return { state: input.state, selectedWaypoint: false };
  }
  const point = {
    ...selection.candidate,
    z: input.groundAt(selection.candidate.x, selection.candidate.y),
  };
  const state = { ...input.state, candidateCursor: selection.nextCursor };
  if (!input.isReachable(point)) {
    return { state, selectedWaypoint: false };
  }
  return {
    state: {
      ...state,
      waypoint: point,
      visitedWaypointKeys: [
        ...state.visitedWaypointKeys,
        searchPointKey(point),
      ],
    },
    target: point,
    selectedWaypoint: true,
  };
}

function nextUnvisitedCandidate(input: SearchAdvanceInput): {
  readonly candidate: EnemySearchCandidate;
  readonly nextCursor: number;
} | null {
  let cursor = input.state.candidateCursor;
  while (cursor < input.candidates.length) {
    const candidate = input.candidates[cursor];
    cursor++;
    if (candidate &&
        !input.state.visitedWaypointKeys.includes(
          searchPointKey(candidate),
        )) return { candidate, nextCursor: cursor };
  }
  return null;
}

export function searchPointKey(
  point: { readonly x: number; readonly y: number },
): string {
  return `${Math.floor(point.x)},${Math.floor(point.y)}`;
}
