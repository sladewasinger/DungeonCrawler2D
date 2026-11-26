/** Unit tests for deterministic 5-biome macro sampling and danger tier escalation. */
import { describe, expect, it } from "vitest";
import { computeDangerTier, sampleMacroBiome } from "./macroBiome.js";

const BIOME_VERDANT = "verdant-forest";

describe("macroBiome sampling & danger scaling", () => {
  it("always keeps the spawn region inside r < 28 as verdant-forest Tier 1", () => {
    for (const [wx, wy] of [[0, 0], [10, -8], [-15, 12], [20, 15]] as const) {
      expect(sampleMacroBiome(1337, wx, wy)).toBe(BIOME_VERDANT);
      expect(computeDangerTier(BIOME_VERDANT, wx, wy)).toBe(1);
    }
  });

  it("samples all 5 biomes across a wide exploration radius deterministically", () => {
    const found = new Set<string>();
    for (let y = -280; y <= 280; y += 20) {
      for (let x = -280; x <= 280; x += 20) {
        found.add(sampleMacroBiome(1337, x, y));
      }
    }
    expect(found.has(BIOME_VERDANT)).toBe(true);
    expect(found.has("autumn-woods")).toBe(true);
    expect(found.has("misty-bog")).toBe(true);
    expect(found.has("craggy-highlands")).toBe(true);
    expect(found.has("cursed-ruinlands")).toBe(true);
  });

  it("escalates danger tier by both biome severity and distance from origin", () => {
    expect(computeDangerTier("autumn-woods", 30, 0)).toBe(2);
    expect(computeDangerTier("craggy-highlands", 35, 0)).toBe(3);
    expect(computeDangerTier(BIOME_VERDANT, 220, 0)).toBe(4);
    expect(computeDangerTier("cursed-ruinlands", 80, 0)).toBe(4);
  });
});
