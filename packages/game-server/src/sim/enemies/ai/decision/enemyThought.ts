import {
  TICK_DT,
  enemyThink,
  type EnemyDecision,
} from "@dc2d/engine";
import type { EnemySlot, SimState } from "../../../state/state.js";
import { ENEMY_SIMULATION_TUNING } from "../../configuration/enemySimulationTuning.js";
import { enemyMemoryArrivalTolerance } from "../enemyMemoryTuning.js";
import { withEnemySearch } from "../search/enemySearch.js";
import { recordEnemySearchObservation } from "../search/enemySearchObservation.js";

interface EnemyThoughtInput {
  readonly sim: SimState;
  readonly enemy: EnemySlot;
  readonly target: EnemySlot["entity"] | undefined;
}

export function thinkForEnemy(input: EnemyThoughtInput): EnemyDecision {
  const { sim, enemy, target } = input;
  if (target) recordEnemySearchObservation(
    enemy,
    target,
    ENEMY_SIMULATION_TUNING.perception.memorySearchObservationMinimumTiles,
  );
  const arrivalTolerance = enemyMemoryArrivalTolerance(sim, enemy);
  const decision = enemyThink({
    brain: enemy.brain,
    enemy: enemy.entity,
    def: enemy.def,
    players: target ? [target] : [],
    inSanctuary: (entity) => sim.effects.inSanctuary(entity),
    dt: TICK_DT,
    rng: () => sim.rng.next(),
    memorySeconds: ENEMY_SIMULATION_TUNING.perception.memorySeconds,
    memorySearchSeconds:
      ENEMY_SIMULATION_TUNING.perception.memorySearchSeconds,
    memoryArrivalTolerance: arrivalTolerance,
    maximumMeleeHeightDifference:
      ENEMY_SIMULATION_TUNING.perception.maximumMeleeHeightDifference,
  });
  return withEnemySearch({ sim, enemy, visibleTarget: target, decision, arrivalTolerance });
}
