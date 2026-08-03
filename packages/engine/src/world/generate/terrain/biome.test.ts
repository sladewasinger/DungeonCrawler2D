import { describe, expect, it } from "vitest";
import { hashString } from "../../../core/rng.js";
import { floorBiomeAt, generateFiniteFloor } from "../finiteFloor.js";

describe("world biomes", () => {
  it("is deterministic across the completed finite biome plane", () => {
    const input = { worldSeed: hashString("biome-world"), floor: 3 };
    const first = generateFiniteFloor(input);
    const second = generateFiniteFloor(input);
    expect(Array.from(second.biome)).toEqual(Array.from(first.biome));
    expect(second.identity.fingerprint).toBe(first.identity.fingerprint);
  }, 10_000);

  it("uses every configured biome and rejects outside lookups", () => {
    const floor = generateFiniteFloor({ worldSeed: hashString("biome-variety"), floor: 1 });
    expect(new Set(floor.biome)).toEqual(new Set([0, 1, 2, 3]));
    expect(floorBiomeAt(floor, floor.spawn.x, floor.spawn.y)).not.toBeNull();
    expect(floorBiomeAt(floor, floor.bounds.minX - 1, floor.bounds.minY)).toBeNull();
  }, 10_000);
});
