import { TICK_DT } from "@dc2d/engine";
import type { EnemySlot, SimState } from "../../state/state.js";
import { ENEMY_SIMULATION_TUNING } from "../configuration/enemySimulationTuning.js";

export function enemyMemoryArrivalTolerance(
  sim: SimState,
  enemy: EnemySlot,
): number {
  const speed = enemy.entity.baseSpeed *
    sim.effects.speedMult(enemy.entity);
  const stepTolerance = speed * TICK_DT +
    ENEMY_SIMULATION_TUNING.perception.memoryArrivalMarginTiles;
  return Math.max(
    ENEMY_SIMULATION_TUNING.perception.memoryArrivalMinimumTiles,
    stepTolerance,
  );
}
