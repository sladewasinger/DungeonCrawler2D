import { describe, it } from "vitest";
import { assertReachableSeed, REACHABILITY_SEEDS } from "./bossArenaInvariantSupport.js";

describe("boss arena reachability", () => {
  it("reaches the wider network for reachability seeds 0-11", () => {
    for (const seed of REACHABILITY_SEEDS) assertReachableSeed(seed);
  });
});
