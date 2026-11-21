import { describe, it } from "vitest";
import { assertRingSeed, BOSS_SEEDS } from "./bossArenaInvariantSupport.js";

describe("boss arena ring shard C", () => {
  it("preserves the sealed ring for shard seeds 16-23", () => {
    for (const seed of BOSS_SEEDS.slice(16, 24)) assertRingSeed(seed);
  });
});
