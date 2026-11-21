import { describe, expect, it } from "vitest";
import {
  createFloorRegistryFixture,
  disposeFloorRegistryFixture,
} from "./floorRegistryTestSupport.js";

describe("FloorRegistry authoritative floor ownership", () => {
  it("reuses one authoritative floor sim for connections on the same floor", async () => {
    const floors = createFloorRegistryFixture({ floors: [1] });
    try {
      const first = floors.joinSim("client-a");
      const second = floors.joinSim("client-b");

      expect(second).toBe(first);
      expect(second.world).toBe(first.world);
      expect(floors.activeSims()).toHaveLength(1);
    } finally {
      await disposeFloorRegistryFixture(floors);
    }
  });
});
