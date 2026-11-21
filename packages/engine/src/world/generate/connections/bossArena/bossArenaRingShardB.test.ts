import { describe, it } from "vitest";
import { assertRingSeed, BOSS_SEEDS } from "./bossArenaInvariantSupport.js";

describe("boss arena ring shard B", () => {
  it("preserves the sealed ring for shard seeds 8-15", () => {
    for (const seed of BOSS_SEEDS.slice(8, 16)) assertRingSeed(seed);
  });
});
