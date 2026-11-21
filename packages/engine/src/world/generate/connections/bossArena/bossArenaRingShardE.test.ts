import { describe, it } from "vitest";
import { assertRingSeed, BOSS_SEEDS } from "./bossArenaInvariantSupport.js";

describe("boss arena ring shard E", () => {
  it("preserves the sealed ring for shard seeds 32-39", () => {
    for (const seed of BOSS_SEEDS.slice(32, 40)) assertRingSeed(seed);
  });
});
