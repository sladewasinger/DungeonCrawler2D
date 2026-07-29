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
import { createSimState } from "../state/state.js";
import { spawnEnemyPack } from "./population.js";
import { enemyRosterForBiome } from "./populationRoster.js";
import { resolveSpawnAnchor } from "../spawn/spawn.js";
import { ENEMY_SIMULATION_TUNING } from "./configuration/enemySimulationTuning.js";

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

  it("spawns a tight pack with at most one off-theme wanderer", () => {
    const sim = createTestSim();
    spawnEnemyPack(sim, 8, 8);
    const enemies = [...sim.enemies.values()];
    expect(enemies.length).toBeGreaterThanOrEqual(2);
    const counts = new Map<string, number>();
    for (const enemy of enemies) {
      counts.set(enemy.def.id, (counts.get(enemy.def.id) ?? 0) + 1);
    }
    expect(Math.max(...counts.values())).toBeGreaterThanOrEqual(enemies.length - 1);
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

  it("keeps packs next to the floor-one spawn anchor small", () => {
    const sim = createTestSim("near-spawn-population");
    const anchor = resolveSpawnAnchor(sim);
    spawnEnemyPack(
      sim,
      Math.floor(anchor.x / 32),
      Math.floor(anchor.y / 32),
    );
    expect(sim.enemies.size).toBeGreaterThanOrEqual(1);
    expect(sim.enemies.size).toBeLessThanOrEqual(2);
  });
});
