import { BIOME } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { resolveDeaths } from "../../../combat/deaths.js";
import { miniBossEncounterMembers } from "../../miniBossArena/encounterPlacement.js";
import { enemyRosterForBiome } from "../../populationRoster.js";
import {
  createMiniBossPopulationSim,
  requireMiniBossArenaLeader,
  spawnMiniBossPopulationEncounter,
} from "./populationTestSupport.js";

const ORC_COMPOSITION = "orc-warlord";
const DEMON_COMPOSITION = "greater-demon";
const GREATER_DEMON = "big-demon";
const DEMON_MINIONS = ["chort", "chort", "chort"];
const ORC_MINIONS = ["masked-orc", "orc-shaman", "orc-warrior"];

describe("mini-boss encounter compositions", () => {
  it("deterministically finds both variants in the bounded arena search", () => {
    const seed = "mini-boss-compositions";
    const orcFirst = spawnMiniBossPopulationEncounter(
      createMiniBossPopulationSim(seed),
      ORC_COMPOSITION,
    );
    const orcRepeat = spawnMiniBossPopulationEncounter(
      createMiniBossPopulationSim(seed),
      ORC_COMPOSITION,
    );
    const demon = spawnMiniBossPopulationEncounter(
      createMiniBossPopulationSim(seed),
      DEMON_COMPOSITION,
    );

    expect(orcFirst.key).toBe(orcRepeat.key);
    expect(orcFirst.key).not.toBe(demon.key);
  });

  it("spawns the selected leader and three themed minions", () => {
    assertComposition({
      compositionId: ORC_COMPOSITION,
      leaderDefId: ORC_COMPOSITION,
      minionDefIds: ORC_MINIONS,
    });
    assertComposition({
      compositionId: DEMON_COMPOSITION,
      leaderDefId: GREATER_DEMON,
      minionDefIds: DEMON_MINIONS,
    });
  });

  it("clears an arena only when its explicit leader dies", () => {
    const sim = createMiniBossPopulationSim("mini-boss-leader-completion");
    const arena = spawnMiniBossPopulationEncounter(sim, DEMON_COMPOSITION);
    const minion = [...sim.enemies.values()].find((enemy) => !enemy.arenaLeader);
    if (!minion) throw new Error("missing arena minion");

    minion.entity.hp = 0;
    resolveDeaths(sim);
    expect(sim.defeatedMiniBossArenas.has(arena.key)).toBe(false);
    expect(requireMiniBossArenaLeader(sim).arenaKey).toBe(arena.key);

    requireMiniBossArenaLeader(sim).entity.hp = 0;
    resolveDeaths(sim);
    expect(sim.defeatedMiniBossArenas.has(arena.key)).toBe(true);
    expect([...sim.enemies.values()].every((enemy) =>
      enemy.arenaKey === undefined && enemy.home === undefined
    )).toBe(true);
  });

  it("reserves Greater Demon for arena encounters", () => {
    for (const biome of Object.values(BIOME)) {
      expect(enemyRosterForBiome(biome)).not.toContain(GREATER_DEMON);
    }
  });

  it("does not truncate an authored encounter to fit the enemy cap", () => {
    const sim = createMiniBossPopulationSim("mini-boss-capacity");
    const arena = spawnMiniBossPopulationEncounter(sim);
    sim.enemies.clear();

    expect(miniBossEncounterMembers({
      sim,
      arena,
      maximumEnemies: 3,
    })).toEqual([]);
  });
});

interface CompositionAssertion {
  readonly compositionId: "orc-warlord" | "greater-demon";
  readonly leaderDefId: string;
  readonly minionDefIds: readonly string[];
}

function assertComposition(input: CompositionAssertion): void {
  const sim = createMiniBossPopulationSim("mini-boss-compositions");
  spawnMiniBossPopulationEncounter(sim, input.compositionId);
  const leader = requireMiniBossArenaLeader(sim);
  const minions = [...sim.enemies.values()]
    .filter((enemy) => !enemy.arenaLeader)
    .map((enemy) => enemy.def.id)
    .sort();
  expect(leader.def.id).toBe(input.leaderDefId);
  expect(minions).toEqual([...input.minionDefIds].sort());
}
