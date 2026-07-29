import {
  findGridPath,
  type GridPathStep,
} from "@dc2d/engine";
import type { EnemySlot, SimState } from "../../state/state.js";
import { ENEMY_SIMULATION_TUNING } from "../configuration/enemySimulationTuning.js";

export interface EnemyMemoryPathInput {
  readonly sim: SimState;
  readonly enemy: EnemySlot;
  readonly pursuit: { x: number; y: number; z: number } | undefined;
  readonly canEnter?: (x: number, y: number) => boolean;
}

interface RememberedRouteKey {
  readonly targetId: string;
  readonly goalTileX: number;
  readonly goalTileY: number;
}

export function rememberedRouteFor(
  input: EnemyMemoryPathInput,
): NonNullable<EnemySlot["rememberedRoute"]> {
  const target = input.enemy.brain.rememberedTarget;
  const key = rememberedRouteKey(input, target?.targetId ?? "");
  const route = input.enemy.rememberedRoute;
  if (target && routeMatches(route, key)) return route;
  const next: NonNullable<EnemySlot["rememberedRoute"]> = {
    ...key,
    steps: findEnemyMemoryPath(input),
  };
  input.enemy.rememberedRoute = next;
  return next;
}

function rememberedRouteKey(
  input: EnemyMemoryPathInput,
  targetId: string,
): RememberedRouteKey {
  return {
    targetId,
    goalTileX: Math.floor(
      input.pursuit?.x ?? input.enemy.entity.body.x,
    ),
    goalTileY: Math.floor(
      input.pursuit?.y ?? input.enemy.entity.body.y,
    ),
  };
}

function routeMatches(
  route: EnemySlot["rememberedRoute"],
  key: RememberedRouteKey,
): route is NonNullable<EnemySlot["rememberedRoute"]> {
  return route != null &&
    route.targetId === key.targetId &&
    route.goalTileX === key.goalTileX &&
    route.goalTileY === key.goalTileY;
}

export function findEnemyMemoryPath(
  input: EnemyMemoryPathInput,
): GridPathStep[] {
  const tuning = ENEMY_SIMULATION_TUNING.perception;
  return findGridPath({
    world: input.sim.world,
    start: input.enemy.entity.body,
    goal: input.pursuit ?? input.enemy.entity.body,
    options: {
      maxExpansions: tuning.memoryPathMaxExpansions,
      margin: tuning.memoryPathMarginTiles,
      maxJumpRise: tuning.jumpRiseTiles,
      jumpThreshold: tuning.jumpRiseTiles - tuning.jumpHeightTolerance,
      canEnter: ({ x, y }) => canEnterMemoryPath(input, x, y),
    },
  });
}

function canEnterMemoryPath(
  input: EnemyMemoryPathInput,
  x: number,
  y: number,
): boolean {
  if (!baseTerrainIsEnterable(input, x, y)) return false;
  if (input.canEnter && !input.canEnter(x, y)) return false;
  return insideEnemyHome(input.enemy, x, y);
}

function baseTerrainIsEnterable(
  input: EnemyMemoryPathInput,
  x: number,
  y: number,
): boolean {
  return input.sim.world.isWalkable(x, y) &&
    !input.sim.world.isSanctuary(x, y);
}

function insideEnemyHome(
  enemy: EnemySlot,
  x: number,
  y: number,
): boolean {
  const home = enemy.home;
  return !home ||
    (x >= home.x0 && x <= home.x1 && y >= home.y0 && y <= home.y1);
}
