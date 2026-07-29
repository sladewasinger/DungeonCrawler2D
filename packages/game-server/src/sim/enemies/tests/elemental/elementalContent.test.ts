import { BIOME } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { enemyRosterForBiome } from "../../populationRoster.js";
import { createEnemyTestSim } from "../enemyAiTestSupport.js";

describe("elemental enemy content", () => {
  it("keeps Plant Creeper and adds a distinct Pitchbloom definition", () => {
    const enemies = createEnemyTestSim().content.enemies;
    const plant = enemies.get("plant-creeper");
    const pitchbloom = enemies.get("pitchbloom");
    expect(plant?.attack.elemental).toBeUndefined();
    expect(pitchbloom?.attack.elemental).toBe("oil-lob");
    expect(pitchbloom?.id).not.toBe(plant?.id);
  });

  it("spawns Pitchbloom natively without replacing Plant Creeper", () => {
    expect(enemyRosterForBiome(BIOME.Pools)).toContain("pitchbloom");
    expect(enemyRosterForBiome(BIOME.Pillars)).toContain("plant-creeper");
  });

  it("assigns the directional flame only to Chort", () => {
    const elemental = [...createEnemyTestSim().content.enemies.values()].filter((enemy) =>
      enemy.attack.elemental === "directional-flame"
    );
    expect(elemental.map((enemy) => enemy.id)).toEqual(["chort"]);
  });
});
