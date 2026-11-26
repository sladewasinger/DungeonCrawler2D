/** Unit tests for deterministic 3.5x 5-biome macro sampling and 5-tier distance progression. */
import { describe, expect, it } from "vitest";
import { SPAWN_SAFE_BIOME_RADIUS, computeDangerTier, distanceDangerTier, sampleMacroBiome } from "./macroBiome.js";

const BIOME_VERDANT = "verdant-forest";

describe("macroBiome sampling & 5-tier distance scaling", () => {
  it("keeps the sheltered starter valley inside r < SPAWN_SAFE_BIOME_RADIUS as verdant-forest Tier 1", () => {
    expect(SPAWN_SAFE_BIOME_RADIUS).toBe(220);
    for (const [wx, wy] of [[0, 0], [100, -80], [-140, 120], [180, 100]] as const) {
      expect(sampleMacroBiome(1337, wx, wy)).toBe(BIOME_VERDANT);
      expect(computeDangerTier(BIOME_VERDANT, wx, wy)).toBe(1);
    }
  });

  it("samples all 5 biomes across a 4200-tile exploration radius deterministically", () => {
    const found = new Set<string>();
    for (let y = -4200; y <= 4200; y += 280) {
      for (let x = -4200; x <= 4200; x += 280) {
        found.add(sampleMacroBiome(1337, x, y));
      }
    }
    expect(found.has(BIOME_VERDANT)).toBe(true);
    expect(found.has("autumn-woods")).toBe(true);
    expect(found.has("misty-bog")).toBe(true);
    expect(found.has("craggy-highlands")).toBe(true);
    expect(found.has("cursed-ruinlands")).toBe(true);
  });

  it("escalates danger tiers strictly by distance milestones (1000 / 2000 / 3500 / 6000)", () => {
    expect(distanceDangerTier(0, 0)).toBe(1);
    expect(distanceDangerTier(999, 0)).toBe(1);
    expect(computeDangerTier("autumn-woods", 350, 0)).toBe(1);
    expect(distanceDangerTier(1000, 0)).toBe(2);
    expect(distanceDangerTier(1999, 0)).toBe(2);
    expect(distanceDangerTier(2000, 0)).toBe(3);
    expect(distanceDangerTier(3499, 0)).toBe(3);
    expect(distanceDangerTier(3500, 0)).toBe(4);
    expect(distanceDangerTier(5999, 0)).toBe(4);
    expect(distanceDangerTier(6000, 0)).toBe(5);
    expect(computeDangerTier("cursed-ruinlands", 6100, 0)).toBe(5);
  });
});
