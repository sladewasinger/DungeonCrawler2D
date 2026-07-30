import {
  NEUTRAL_INPUT,
  type EnemyDecision,
  type GridPathStep,
} from "@dc2d/engine";
import type { EnemySearchPoint } from "../../../state/enemyState.js";
import type { EnemySlot, SimState } from "../../../state/state.js";
import { ENEMY_SIMULATION_TUNING } from "../../configuration/enemySimulationTuning.js";
import { createEnemySearchState, rejectEnemySearchWaypointState } from "./enemySearchStateMachine.js";
import { rememberedSearchDirection } from "./enemySearchObservation.js";
import {
  advanceEnemySearchPlan,
} from "./enemySearchPlanning.js";
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
  memory: NonNullable<EnemySlot["brain"]["rememberedTarget"]>,
): SearchPlan {
  const state = input.enemy.searchState ??
    createEnemySearchState(
      memory,
      ENEMY_SIMULATION_TUNING.perception.memorySearchWaypointPauseTicks,
      rememberedSearchDirection(input.enemy.lastObservedTarget, memory.targetId),
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
  return advanceEnemySearchPlan({
    sim: input.sim,
    enemy: input.enemy,
    state,
    radius,
    arrivalTolerance: input.arrivalTolerance,
    waypointPauseTicks:
      ENEMY_SIMULATION_TUNING.perception.memorySearchWaypointPauseTicks,
    forwardDistance:
      ENEMY_SIMULATION_TUNING.perception.memorySearchForwardDistanceTiles,
  });
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
