import { LEVEL } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { spawnEnemy } from "../core/helpers.js";
import { resolveSpawnAnchor } from "../spawn/spawn.js";
import { ENEMY_SIMULATION_TUNING } from "./configuration/enemySimulationTuning.js";
import {
  nearSpawnPopulationCenter,
  NEAR_SPAWN_POPULATION_RADIUS_TILES,
} from "./population/nearSpawn.js";
import {
  addPopulationTestPlayer,
  countPopulation,
  createPopulationTestSim,
} from "./population/populationTestSupport.js";
import { repopulateNearSpawn } from "./repopulation.js";

describe("occupied-area repopulation", () => {
  it("preserves ordinary density on deeper floors", () => {
    const sim = createPopulationTestSim({ floor: 2 });
    const center = resolveSpawnAnchor(sim);
    addPopulationTestPlayer(sim, center);

    repopulateNearSpawn(sim);

    expect(countPopulation({
      sim,
      anchor: center,
      radius: ENEMY_SIMULATION_TUNING.population.occupiedAreaRadiusTiles,
    })).toBe(ENEMY_SIMULATION_TUNING.population.occupiedAreaTargetCount);
  });

  it("recycles distant enemies and restores the active area", () => {
    const sim = createPopulationTestSim();
    const anchor = nearSpawnPopulationCenter();
    addPopulationTestPlayer(sim, anchor);
    for (let index = 0; index < 150; index++) {
      spawnEnemy(sim, {
        defId: "slime",
        x: anchor.x + 500 + index,
        y: anchor.y + 500,
      });
    }

    repopulateNearSpawn(sim);

    expect(sim.enemies.size).toBeLessThanOrEqual(150);
    expect(countPopulation({
      sim,
      anchor,
      radius: NEAR_SPAWN_POPULATION_RADIUS_TILES,
    })).toBeGreaterThan(0);
  });

  it.each([LEVEL.Sandbox, LEVEL.CombatSandbox])(
    "is a no-op in the %s level",
    (level) => {
      const sim = createPopulationTestSim({ level });
      const center = resolveSpawnAnchor(sim);
      addPopulationTestPlayer(sim, center);

      repopulateNearSpawn(sim);

      expect(sim.enemies.size).toBe(0);
    },
  );
});
