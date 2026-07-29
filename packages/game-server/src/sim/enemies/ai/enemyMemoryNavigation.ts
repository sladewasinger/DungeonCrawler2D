import {
  findGridPath,
  type MoveInput,
} from "@dc2d/engine";
import type { EnemySlot, SimState } from "../../state/state.js";
import { ENEMY_SIMULATION_TUNING } from "../configuration/enemySimulationTuning.js";

interface MemoryNavigation {
  readonly sim: SimState;
  readonly enemy: EnemySlot;
  readonly visibleTarget: EnemySlot["entity"] | undefined;
  readonly pursuit: { x: number; y: number; z: number } | undefined;
  readonly move: MoveInput;
}

/** Routes remembered pursuits around the wall that just broke sight. */
export function withEnemyMemoryPath(input: MemoryNavigation): MoveInput {
  if (input.visibleTarget || !input.pursuit) return input.move;
  const step = memoryPath(input)[0];
  if (!step) return input.move;
  return {
    moveX: Math.sign(step.x - input.enemy.entity.body.x),
    moveY: Math.sign(step.y - input.enemy.entity.body.y),
    jump: step.jump,
  };
}

function memoryPath(input: MemoryNavigation) {
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
  input: MemoryNavigation,
  x: number,
  y: number,
): boolean {
  if (!input.sim.world.isWalkable(x, y) ||
      input.sim.world.isSanctuary(x, y)) return false;
  const home = input.enemy.home;
  return !home ||
    (x >= home.x0 && x <= home.x1 && y >= home.y0 && y <= home.y1);
}
