import { describe, it } from "vitest";
import { assertRingSeed, BOSS_SEEDS } from "./bossArenaInvariantSupport.js";

describe("boss arena ring shard D", () => {
  it("preserves the sealed ring for shard seeds 24-31", () => {
    for (const seed of BOSS_SEEDS.slice(24, 32)) assertRingSeed(seed);
  });
});
