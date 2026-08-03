import {
  areasData,
  areaReactionsData,
  enemiesData,
  itemsData,
  recipesData,
  rulesData,
  statusesData,
} from "@dc2d/content";
import {
  BIOME,
  buildContentRegistry,
  hashString,
  World,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { PlayerStore } from "../../store.js";
import { spawnEnemy } from "../core/helpers.js";
import { createSimState } from "../state/state.js";
import { spawnEnemyPack } from "./population.js";
import {
  enemyRosterForBiome,
  RANDOM_ENEMY_ROSTER,
} from "./populationRoster.js";
import { ENEMY_SIMULATION_TUNING } from "./configuration/enemySimulationTuning.js";
import { nearSpawnPopulationCenter } from "./population/nearSpawn.js";
import {
  expectPackMembers,
  spawnControlledOutlierPack,
  spawnRepeatedAnchorPack,
} from "./population/testSupport/populationCohesionSupport.js";
import { expectTerritoryRoster, sampleTerritories } from "./population/testSupport/populationTerritoryTestSupport.js";

const content = buildContentRegistry({
  statuses: [...statusesData],
  rules: [...rulesData],
  areas: [...areasData],
  areaReactions: [...areaReactionsData],
  items: [...itemsData],
  enemies: [...enemiesData],
  recipes: [...recipesData],
});

function createTestSim(seed = "cohesive-population") {
  const worldSeed = hashString(seed);
  return createSimState({
    world: new World(worldSeed, 1), content, store: new PlayerStore(null), rngSeed: worldSeed, opts: {},
  });
}

describe("cohesive district enemy population", () => {
  it("assigns a narrow native roster to every biome", () => {
    for (const biome of Object.values(BIOME)) {
      const roster = enemyRosterForBiome(biome);
      expect(roster.length).toBeGreaterThanOrEqual(3);
      for (const defId of roster) expect(content.enemies.has(defId)).toBe(true);
    }
    expect(enemyRosterForBiome(BIOME.Pools)).toContain("slime");
    expect(enemyRosterForBiome(BIOME.Maze)).toContain("orc-warrior");
  });

  it("never puts the sandbox training dummy in a random dungeon roster", () => {
    expect(RANDOM_ENEMY_ROSTER).not.toContain("training-dummy");
    for (const biome of Object.values(BIOME)) {
      expect(enemyRosterForBiome(biome)).not.toContain("training-dummy");
    }
  });

  it("uses territory ownership to select faction-domain mobs", () => {
    const sim = createTestSim("territory-owned-population");
    const samples = sampleTerritories(sim);
    expect(samples.size).toBe(4);
    for (const [id, point] of samples) expectTerritoryRoster(sim, id, point);
  }, 30_000);

  it("spawns a tight pack with at most one off-theme wanderer", () => {
    const sim = createTestSim();
    spawnEnemyPack(sim, 8, 8);
    const enemies = [...sim.enemies.values()];
    expect(enemies.length).toBeGreaterThanOrEqual(2);
    const counts = new Map<string, number>();
    for (const enemy of enemies) {
      counts.set(enemy.def.id, (counts.get(enemy.def.id) ?? 0) + 1);
    }
    expect(counts.get("chort")).toBe(1);
    expect(counts.get("pitchbloom")).toBe(1);
    for (const a of enemies) {
      for (const b of enemies) {
        expect(Math.hypot(
          a.entity.body.x - b.entity.body.x,
          a.entity.body.y - b.entity.body.y,
        )).toBeLessThanOrEqual(
          ENEMY_SIMULATION_TUNING.population.packSpreadRadiusTiles * 2,
        );
      }
    }
  });

  it("keeps the required pair across deterministic remote pack seeds", { timeout: 45_000 }, () => {
    for (const seed of ["remote-pack-a", "remote-pack-b", "remote-pack-c"]) {
      const sim = createTestSim(seed);
      spawnEnemyPack(sim, 8, 8);
      const ids = new Set([...sim.enemies.values()].map((enemy) => enemy.def.id));
      expect(ids.has("chort")).toBe(true);
      expect(ids.has("pitchbloom")).toBe(true);
      expect(sim.enemies.size).toBeGreaterThanOrEqual(
        ENEMY_SIMULATION_TUNING.population.dungeonPackMinimum,
      );
      expect(sim.enemies.size).toBeLessThanOrEqual(
        ENEMY_SIMULATION_TUNING.population.dungeonPackMaximum,
      );
      expectPackMembers(sim);
    }
  });

  it("rejects the pair when controlled placement repeats the anchor", () => {
    const sim = createTestSim("second-placement-unavailable");
    spawnRepeatedAnchorPack(sim);

    expect([...sim.enemies.values()]).toEqual([]);
  });

  it("keeps native supplements and one deterministic global outlier", () => {
    const sim = createTestSim("controlled-optional-outlier");
    spawnControlledOutlierPack(sim);

    expect([...sim.enemies.values()].map((enemy) => enemy.def.id)).toEqual([
      "chort", "pitchbloom", expect.any(String), "plant-creeper",
    ]);
    expectPackMembers(sim);
  });

  it("uses the configured pack bounds next to the floor-one spawn anchor", () => {
    const sim = createTestSim("near-spawn-population");
    const anchor = nearSpawnPopulationCenter();
    spawnEnemyPack(
      sim,
      Math.floor(anchor.x / 32),
      Math.floor(anchor.y / 32),
    );
    const tuning = ENEMY_SIMULATION_TUNING.population;
    expect(sim.enemies.size).toBeGreaterThanOrEqual(tuning.nearSpawnPackMinimum);
    expect(sim.enemies.size).toBeLessThanOrEqual(tuning.nearSpawnPackMaximum);
    expect([...sim.enemies.values()].map((enemy) => enemy.def.id)).toEqual(
      expect.arrayContaining(["chort", "pitchbloom"]),
    );
  });

  it("keeps the required pair atomic when the global cap is full", () => {
    const sim = createTestSim("full-population");
    for (let index = 0; index < 150; index += 1) {
      spawnEnemy(sim, { defId: "slime", x: 1000 + index, y: 1000 });
    }

    spawnEnemyPack(sim, 8, 8);

    expect(sim.enemies.size).toBe(150);
    expect([...sim.enemies.values()].some((enemy) => enemy.def.id === "chort")).toBe(false);
    expect([...sim.enemies.values()].some((enemy) => enemy.def.id === "pitchbloom")).toBe(false);
  });
});
