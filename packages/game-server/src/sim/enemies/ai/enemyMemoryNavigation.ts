import {
  beginEnemySearch,
  NEUTRAL_INPUT,
  type GridPathStep,
  type MoveInput,
} from "@dc2d/engine";
import type { EnemySlot, SimState } from "../../state/state.js";
import { ENEMY_SIMULATION_TUNING } from "../configuration/enemySimulationTuning.js";
import { rememberedRouteFor } from "./enemyMemoryPath.js";
import { rejectEnemySearchWaypoint } from "./search/enemySearch.js";
import {
  initializeRouteProgress,
  routeProgressAfterMotion,
} from "./rememberedRouteProgress.js";
import {
  decideRememberedRouteSteering,
} from "./rememberedRouteSteering.js";

interface MemoryNavigation {
  readonly sim: SimState;
  readonly enemy: EnemySlot;
  readonly visibleTarget: EnemySlot["entity"] | undefined;
  readonly pursuit: { x: number; y: number; z: number } | undefined;
  readonly move: MoveInput;
}

interface ActiveRouteStep {
  readonly route: NonNullable<EnemySlot["rememberedRoute"]>;
  readonly step: GridPathStep | undefined;
}

/** Routes remembered pursuits around the wall that just broke sight. */
export function withEnemyMemoryPath(input: MemoryNavigation): MoveInput {
  if (input.visibleTarget || !input.pursuit) {
    input.enemy.rememberedRoute = null;
    return input.move;
  }
  const { route, step } = activeRouteStep(input);
  if (!step) return noRouteMove(input, route);
  const decision = decideRememberedRouteSteering({
    body: input.enemy.entity.body,
    step,
    alignmentTolerance:
      ENEMY_SIMULATION_TUNING.perception.waypointAlignmentToleranceTiles,
  });
  if (decision.state === "invalid") return invalidRouteMove(input);
  route.progress = initializeRouteProgress(
    route.progress,
    step,
    input.enemy.entity.body,
  );
  return decision.move;
}

export function recordEnemyRouteMotion(
  enemy: EnemySlot,
  move: MoveInput,
): void {
  const route = enemy.rememberedRoute;
  const step = route?.steps[0];
  if (!route || !step) return;
  route.progress = routeProgressAfterMotion({
    previous: route.progress,
    step,
    position: enemy.entity.body,
    movementRequested: move.moveX !== 0 || move.moveY !== 0,
    minimumProgress:
      ENEMY_SIMULATION_TUNING.perception.memoryRouteMinimumProgressTiles,
  });
  if (route.progress.stalledTicks <
      ENEMY_SIMULATION_TUNING.perception.memoryRouteStallTicks) return;
  beginEnemySearch(
    enemy.brain,
    ENEMY_SIMULATION_TUNING.perception.memorySearchSeconds,
  );
  rejectEnemySearchWaypoint(enemy);
  enemy.rememberedRoute = null;
}

function activeRouteStep(input: MemoryNavigation): ActiveRouteStep {
  let route = rememberedRouteFor(input);
  consumeEnteredSteps(input.enemy, route);
  if (route.steps[0] && !isAdjacentStep(input.enemy, route.steps[0])) {
    input.enemy.rememberedRoute = null;
    route = rememberedRouteFor(input);
    consumeEnteredSteps(input.enemy, route);
  }
  return { route, step: route.steps[0] };
}

function consumeEnteredSteps(
  enemy: EnemySlot,
  route: NonNullable<EnemySlot["rememberedRoute"]>,
): void {
  const bodyTileX = Math.floor(enemy.entity.body.x);
  const bodyTileY = Math.floor(enemy.entity.body.y);
  while (route.steps[0] &&
      Math.floor(route.steps[0].x) === bodyTileX &&
      Math.floor(route.steps[0].y) === bodyTileY) {
    route.steps.shift();
    delete route.progress;
  }
}

function noRouteMove(
  input: MemoryNavigation,
  route: NonNullable<EnemySlot["rememberedRoute"]>,
): MoveInput {
  const body = input.enemy.entity.body;
  const atGoalTile = Math.floor(body.x) === route.goalTileX &&
    Math.floor(body.y) === route.goalTileY;
  if (atGoalTile) return input.move;
  return invalidRouteMove(input);
}

function invalidRouteMove(input: MemoryNavigation): MoveInput {
  beginEnemySearch(
    input.enemy.brain,
    ENEMY_SIMULATION_TUNING.perception.memorySearchSeconds,
  );
  rejectEnemySearchWaypoint(input.enemy);
  input.enemy.rememberedRoute = null;
  return NEUTRAL_INPUT;
}

function isAdjacentStep(enemy: EnemySlot, step: GridPathStep): boolean {
  const body = enemy.entity.body;
  const dx = Math.abs(Math.floor(step.x) - Math.floor(body.x));
  const dy = Math.abs(Math.floor(step.y) - Math.floor(body.y));
  return dx + dy === 1;
}
