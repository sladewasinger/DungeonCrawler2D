import {
  NEUTRAL_INPUT,
  hashString,
  type EnemyDecision,
  type GridPathStep,
} from "@dc2d/engine";
import type { EnemySearchPoint } from "../../../state/enemyState.js";
import type { EnemySlot, SimState } from "../../../state/state.js";
import { ENEMY_SIMULATION_TUNING } from "../../configuration/enemySimulationTuning.js";
import { findEnemyMemoryPath } from "../enemyMemoryPath.js";
import { enemySearchCandidates } from "./enemySearchCandidates.js";
import {
  advanceEnemySearchState,
  createEnemySearchState,
  rejectEnemySearchWaypointState,
} from "./enemySearchStateMachine.js";
import { enemySearchMove } from "./enemySearchSteering.js";

interface EnemySearchInput {
  readonly sim: SimState;
  readonly enemy: EnemySlot;
  readonly visibleTarget: EnemySlot["entity"] | undefined;
  readonly decision: EnemyDecision;
  readonly arrivalTolerance: number;
}

interface SearchPlan {
  readonly target: EnemySearchPoint | undefined;
  readonly selectedPath: GridPathStep[] | undefined;
}

interface SearchSelection extends SearchPlan {
  readonly state: NonNullable<EnemySlot["searchState"]>;
}

/** Adds active bounded investigation beneath the brain-owned search timer. */
export function withEnemySearch(
  input: EnemySearchInput,
): EnemyDecision {
  const memory = input.enemy.brain.rememberedTarget;
  if (input.visibleTarget || input.enemy.brain.memoryPhase !== "searching" ||
      !memory) {
    input.enemy.searchState = null;
    return input.decision;
  }
  const plan = planEnemySearch(input, memory);
  return searchAdvanceDecision(input, plan.target, plan.selectedPath);
}

function planEnemySearch(
  input: EnemySearchInput,
  memory: EnemySearchPoint,
): SearchPlan {
  const state = input.enemy.searchState ??
    createEnemySearchState(
      memory,
      ENEMY_SIMULATION_TUNING.perception.memorySearchWaypointPauseTicks,
    );
  const selection = selectEnemySearchWaypoint(input, state);
  input.enemy.searchState = selection.state;
  return selection;
}

function selectEnemySearchWaypoint(
  input: EnemySearchInput,
  state: NonNullable<EnemySlot["searchState"]>,
): SearchSelection {
  const radius = ENEMY_SIMULATION_TUNING.perception.memorySearchRadiusTiles;
  let selectedPath: GridPathStep[] | undefined;
  const advance = advanceEnemySearchState({
    state,
    position: input.enemy.entity.body,
    candidates: enemySearchCandidates({
      anchor: state.anchor,
      radius,
      seed: hashString(input.enemy.entity.id),
    }),
    arrivalTolerance: input.arrivalTolerance,
    waypointPauseTicks:
      ENEMY_SIMULATION_TUNING.perception.memorySearchWaypointPauseTicks,
    groundAt: (x, y) => input.sim.world.groundAt(x, y),
    isReachable: (point) => {
      selectedPath = findEnemyMemoryPath({
        sim: input.sim,
        enemy: input.enemy,
        pursuit: point,
        canEnter: (x, y) =>
          withinSearchRadius({ anchor: state.anchor, radius, x, y }),
      });
      return selectedPath.length > 0;
    },
  });
  return {
    state: advance.state,
    target: advance.target,
    selectedPath,
  };
}

interface SearchRadiusCell {
  readonly anchor: EnemySearchPoint;
  readonly radius: number;
  readonly x: number;
  readonly y: number;
}

function withinSearchRadius(input: SearchRadiusCell): boolean {
  return Math.hypot(
    input.x + 0.5 - input.anchor.x,
    input.y + 0.5 - input.anchor.y,
  ) <= input.radius;
}

export function rejectEnemySearchWaypoint(enemy: EnemySlot): void {
  if (enemy.brain.memoryPhase !== "searching" || !enemy.searchState) return;
  enemy.searchState = rejectEnemySearchWaypointState(enemy.searchState);
  enemy.rememberedRoute = null;
}

function searchAdvanceDecision(
  input: EnemySearchInput,
  target: EnemySearchPoint | undefined,
  selectedPath: GridPathStep[] | undefined,
): EnemyDecision {
  if (!target) {
    input.enemy.rememberedRoute = null;
    return { move: NEUTRAL_INPUT, searching: true };
  }
  if (selectedPath) cacheSearchRoute(input.enemy, target, selectedPath);
  return {
    move: enemySearchMove({
      position: input.enemy.entity.body,
      target,
      arrivalTolerance: input.arrivalTolerance,
    }),
    pursuit: target,
    searching: true,
  };
}

function cacheSearchRoute(
  enemy: EnemySlot,
  target: { readonly x: number; readonly y: number },
  steps: GridPathStep[],
): void {
  enemy.rememberedRoute = {
    targetId: enemy.brain.rememberedTarget?.targetId ?? "",
    goalTileX: Math.floor(target.x),
    goalTileY: Math.floor(target.y),
    steps,
  };
}
