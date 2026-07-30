import { hashString, type GridPathStep } from "@dc2d/engine";
import type { EnemySearchPoint } from "../../../state/enemyState.js";
import type { EnemySlot, SimState } from "../../../state/state.js";
import { findEnemyMemoryPath } from "../enemyMemoryPath.js";
import { enemySearchCandidates } from "./enemySearchCandidates.js";
import { advanceEnemySearchState } from "./enemySearchStateMachine.js";

interface SearchCandidateRequest {
  readonly enemy: EnemySlot;
  readonly state: NonNullable<EnemySlot["searchState"]>;
  readonly radius: number;
  readonly forwardDistance: number;
}

interface SearchPathRequest extends Omit<SearchCandidateRequest, "forwardDistance"> {
  readonly sim: SimState;
  readonly point: EnemySearchPoint;
}

export interface EnemySearchAdvancePlan extends Omit<SearchPathRequest, "point"> {
  readonly arrivalTolerance: number;
  readonly waypointPauseTicks: number;
  readonly forwardDistance: number;
}

interface SearchRadiusRequest {
  readonly anchor: EnemySearchPoint;
  readonly radius: number;
  readonly x: number;
  readonly y: number;
}

export function enemySearchCandidatesFor(
  request: SearchCandidateRequest,
) {
  const { enemy, state, radius, forwardDistance } = request;
  return enemySearchCandidates({
    anchor: state.anchor,
    radius,
    seed: hashString(enemy.entity.id),
    ...(state.forward ? { forward: state.forward } : {}),
    forwardDistance,
  });
}

export function findEnemySearchPath(
  request: SearchPathRequest,
): GridPathStep[] {
  const { sim, enemy, state, radius, point } = request;
  return findEnemyMemoryPath({
    sim,
    enemy,
    pursuit: point,
    canEnter: (x, y) => withinSearchRadius({ anchor: state.anchor, radius, x, y }),
  });
}

export function advanceEnemySearchPlan(
  request: EnemySearchAdvancePlan,
): {
  readonly state: NonNullable<EnemySlot["searchState"]>;
  readonly target: EnemySearchPoint | undefined;
  readonly selectedPath: GridPathStep[] | undefined;
} {
  const { sim, enemy, state, radius, arrivalTolerance, waypointPauseTicks } = request;
  let selectedPath: GridPathStep[] | undefined;
  const advance = advanceEnemySearchState({
    state,
    position: enemy.entity.body,
    candidates: enemySearchCandidatesFor(request),
    arrivalTolerance,
    waypointPauseTicks,
    groundAt: (x, y) => sim.world.groundAt(x, y),
    isReachable: (point) => {
      selectedPath = findEnemySearchPath({ sim, enemy, state, radius, point });
      return selectedPath.length > 0;
    },
  });
  return { state: advance.state, target: advance.target, selectedPath };
}

function withinSearchRadius(input: SearchRadiusRequest): boolean {
  const { anchor, radius, x, y } = input;
  return Math.hypot(x + 0.5 - anchor.x, y + 0.5 - anchor.y) <= radius;
}
