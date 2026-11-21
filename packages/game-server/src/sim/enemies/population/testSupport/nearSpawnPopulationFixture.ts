/** Owns near-spawn population count and bounded refill assertions for tests. */
import { expect } from "vitest";
import type { SimState } from "../../../state/state.js";
import { ENEMY_SIMULATION_TUNING } from "../../configuration/enemySimulationTuning.js";
import { repopulateNearSpawn } from "../../repopulation.js";
import {
  isInsideSpawnEnemyExclusion,
  nearSpawnPopulationCenter,
  NEAR_SPAWN_POPULATION_RADIUS_TILES,
} from "../nearSpawn.js";
import {
  countPopulation,
  ordinaryTypeCounts,
} from "../populationTestSupport.js";

export function ordinaryNearSpawnCount(sim: SimState): number {
  return countPopulation({
    sim,
    anchor: nearSpawnPopulationCenter(),
    radius: NEAR_SPAWN_POPULATION_RADIUS_TILES,
    ordinaryOnly: true,
  });
}

export function maximumNearSpawnTypeCount(sim: SimState): number {
  const counts = ordinaryTypeCounts({
    sim,
    anchor: nearSpawnPopulationCenter(),
    radius: NEAR_SPAWN_POPULATION_RADIUS_TILES,
  });
  return Math.max(0, ...counts.values());
}

export function repopulateNearSpawnToTarget(sim: SimState): void {
  const target = ENEMY_SIMULATION_TUNING.population.nearSpawnTargetCount;
  for (let attempt = 0; attempt < target * 2 && ordinaryNearSpawnCount(sim) < target; attempt += 1) {
    repopulateNearSpawn(sim);
  }
}

export function expectEnemiesOutsideExitBuffer(sim: SimState): void {
  for (const enemy of sim.enemies.values()) {
    if (enemy.arenaKey || enemy.entity.hp <= 0) continue;
    expect(isInsideSpawnEnemyExclusion(sim, enemy.entity.body)).toBe(false);
  }
}
