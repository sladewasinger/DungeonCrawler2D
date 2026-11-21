import { describe, it } from "vitest";
import { assertGeneratedRingSeed, assertRingSeed, BOSS_SEEDS } from "./bossArenaInvariantSupport.js";

describe("boss arena ring shard A", () => {
  it("matches the final generated chunk for the first compatibility seed", () => {
    assertGeneratedRingSeed(BOSS_SEEDS[0] ?? 13);
  });

  it("preserves the sealed ring for shard seeds 0-7", () => {
    for (const seed of BOSS_SEEDS.slice(0, 8)) assertRingSeed(seed);
  });
});
