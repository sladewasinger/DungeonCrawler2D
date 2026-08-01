import { beforeEach, describe, expect, it } from "vitest";
import { spawnEnemy } from "../../core/helpers.js";
import type { SimState } from "../../state/state.js";
import { ENEMY_SIMULATION_TUNING } from "../configuration/enemySimulationTuning.js";
import { activateChunksNearPlayers, spawnEnemyPack } from "../population.js";
import {
  REPOPULATE_INTERVAL_TICKS,
  repopulateNearSpawn,
} from "../repopulation.js";
import {
  isInsideSpawnEnemyExclusion,
  isNearSpawnPopulationPosition,
  nearSpawnPopulationCenter,
  NEAR_SPAWN_POPULATION_RADIUS_TILES,
} from "./nearSpawn.js";
import { enemySpawnCenter } from "../populationPlacement.js";
import {
  addPopulationTestPlayer,
  countPopulation,
  createPopulationTestSim,
  ordinaryTypeCounts,
} from "./populationTestSupport.js";
import {
  findBoundaryPackFixture,
  spawnControlledBoundaryPack,
} from "./testSupport/nearBoundaryPackFixture.js";

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

  it("creates a near-spawn pack with both required species", () => {
    sim.enemies.clear();
    const chunkX = Math.floor(anchor.x / 32);
    const chunkY = Math.floor(anchor.y / 32);

    spawnEnemyPack(sim, chunkX, chunkY);

    const species = new Set([...sim.enemies.values()].map((enemy) => enemy.def.id));
    expect(species.has("chort")).toBe(true);
    expect(species.has("pitchbloom")).toBe(true);
    expect(ordinaryCount(sim)).toBeGreaterThanOrEqual(
      ENEMY_SIMULATION_TUNING.population.nearSpawnPackMinimum,
    );
  });

  it("rejects a required pair atomically at the shared near-spawn cap", () => {
    sim.enemies.clear();
    for (let index = 0; index < ENEMY_SIMULATION_TUNING.population.nearSpawnTargetCount; index += 1) {
      spawnEnemy(sim, { defId: "slime", x: anchor.x + index, y: anchor.y });
    }
    spawnEnemyPack(sim, Math.floor(anchor.x / 32), Math.floor(anchor.y / 32));

    expect(ordinaryCount(sim)).toBe(
      ENEMY_SIMULATION_TUNING.population.nearSpawnTargetCount,
    );
    expect([...sim.enemies.values()].some((enemy) => enemy.def.id === "chort")).toBe(false);
    expect([...sim.enemies.values()].some((enemy) => enemy.def.id === "pitchbloom")).toBe(false);
  });

  it("classifies a boundary pack by centers before accepting or rejecting the pair", () => {
    sim.enemies.clear();
    const fixture = findBoundaryPackFixture(sim);
    const anchorCenter = enemySpawnCenter(fixture.anchor);
    const insideCenter = enemySpawnCenter(fixture.inside);
    const outsideCenter = enemySpawnCenter(fixture.outside);

    expect(isNearSpawnPopulationPosition(sim, anchorCenter)).toBe(true);
    expect(isNearSpawnPopulationPosition(sim, outsideCenter)).toBe(false);
    expect(isInsideSpawnEnemyExclusion(sim, anchorCenter)).toBe(false); expect(isInsideSpawnEnemyExclusion(sim, outsideCenter)).toBe(false);

    spawnControlledBoundaryPack({ sim, fixture, second: fixture.inside });
    expect([...sim.enemies.values()].map((enemy) => enemy.def.id)).toEqual([
      "chort", "pitchbloom",
    ]);
    expect([...sim.enemies.values()].map(({ entity: { body } }) => ({
      x: body.x,
      y: body.y,
    }))).toEqual([
      anchorCenter, insideCenter,
    ]);
    expect([...sim.enemies.values()].every((enemy) =>
      isNearSpawnPopulationPosition(sim, enemy.entity.body),
    )).toBe(true);
    expect([...sim.enemies.values()].every((enemy) =>
      !isInsideSpawnEnemyExclusion(sim, enemy.entity.body),
    )).toBe(true);
    expect(ordinaryCount(sim)).toBe(2); expect(maximumTypeCount(sim)).toBe(1);
    expect(ordinaryCount(sim)).toBeLessThanOrEqual(ENEMY_SIMULATION_TUNING.population.nearSpawnTargetCount);
    expect(maximumTypeCount(sim)).toBeLessThanOrEqual(ENEMY_SIMULATION_TUNING.population.nearSpawnMaximumSameType);

    sim.enemies.clear();
    spawnControlledBoundaryPack({ sim, fixture, second: fixture.outside });
    expect(sim.enemies.size).toBe(0);
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
