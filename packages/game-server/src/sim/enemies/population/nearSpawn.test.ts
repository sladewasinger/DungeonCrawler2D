import { beforeEach, describe, expect, it } from "vitest";
import type { SimState } from "../../state/state.js";
import { ENEMY_SIMULATION_TUNING } from "../configuration/enemySimulationTuning.js";
import { activateChunksNearPlayers } from "../population.js";
import {
  REPOPULATE_INTERVAL_TICKS,
  repopulateNearSpawn,
} from "../repopulation.js";
import {
  isInsideSpawnEnemyExclusion,
  nearSpawnPopulationCenter,
  NEAR_SPAWN_POPULATION_RADIUS_TILES,
} from "./nearSpawn.js";
import {
  addPopulationTestPlayer,
  countPopulation,
  createPopulationTestSim,
  ordinaryTypeCounts,
} from "./populationTestSupport.js";

describe("near-spawn population", () => {
  let sim: SimState;
  const anchor = nearSpawnPopulationCenter();

  beforeEach(() => {
    sim = createPopulationTestSim();
    addPopulationTestPlayer(sim, anchor);
    activateChunksNearPlayers(sim);
  });

  it("shares one bounded population across the first nine outdoor chunks", () => {
    const tuning = ENEMY_SIMULATION_TUNING.population;
    expect(ordinaryCount(sim)).toBeLessThanOrEqual(tuning.nearSpawnTargetCount);
    expect(maximumTypeCount(sim)).toBeLessThanOrEqual(
      tuning.nearSpawnMaximumSameType,
    );
    expectEnemiesOutsideExitBuffer(sim);
  });

  it("restores the bounded density without exceeding the archetype cap", () => {
    sim.enemies.clear();
    sim.tickCount = REPOPULATE_INTERVAL_TICKS;
    repopulateNearSpawn(sim);

    const tuning = ENEMY_SIMULATION_TUNING.population;
    expect(ordinaryCount(sim)).toBe(tuning.nearSpawnTargetCount);
    expect(maximumTypeCount(sim)).toBeLessThanOrEqual(
      tuning.nearSpawnMaximumSameType,
    );
    expectEnemiesOutsideExitBuffer(sim);
  });

  it("does not pile on enemies after reaching the shared target", () => {
    repopulateNearSpawn(sim);
    const before = ordinaryCount(sim);
    repopulateNearSpawn(sim);
    expect(ordinaryCount(sim)).toBe(before);
  });

  it("keeps the cap when outside packs and refill overlap the envelope", () => {
    const player = sim.players.get("p1");
    if (!player) throw new Error("missing population test player");
    player.entity.body.x = anchor.x + NEAR_SPAWN_POPULATION_RADIUS_TILES + 4;
    activateChunksNearPlayers(sim);
    repopulateNearSpawn(sim);

    const tuning = ENEMY_SIMULATION_TUNING.population;
    expect(ordinaryCount(sim)).toBeLessThanOrEqual(tuning.nearSpawnTargetCount);
    expect(maximumTypeCount(sim)).toBeLessThanOrEqual(
      tuning.nearSpawnMaximumSameType,
    );
  });

  function ordinaryCount(currentSim: SimState): number {
    return countPopulation({
      sim: currentSim,
      anchor,
      radius: NEAR_SPAWN_POPULATION_RADIUS_TILES,
      ordinaryOnly: true,
    });
  }

  function maximumTypeCount(currentSim: SimState): number {
    const counts = ordinaryTypeCounts({
      sim: currentSim,
      anchor,
      radius: NEAR_SPAWN_POPULATION_RADIUS_TILES,
    });
    return Math.max(0, ...counts.values());
  }

  function expectEnemiesOutsideExitBuffer(currentSim: SimState): void {
    for (const enemy of currentSim.enemies.values()) {
      if (enemy.arenaKey || enemy.entity.hp <= 0) continue;
      expect(isInsideSpawnEnemyExclusion(currentSim, enemy.entity.body)).toBe(false);
    }
  }
});
