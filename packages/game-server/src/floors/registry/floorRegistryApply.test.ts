import { describe, expect, it } from "vitest";
import {
  createFloorRegistryFixture,
  disposeFloorRegistryFixture,
} from "../floorRegistryTestSupport.js";

describe("authoritative generated-floor apply", () => {
  it("replaces an inactive floor and returns its authoritative identity", { timeout: 30_000 }, async () => {
    const floors = createFloorRegistryFixture({ floors: [1] });
    try {
      const result = await floors.applyGeneratedFloor({ floor: 2, confirm: true });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.generation.configurationFingerprint).toBeTruthy();
      expect(floors.ensureFloor(2).world.floorIdentity).toEqual(result.generation);
    } finally {
      await disposeFloorRegistryFixture(floors);
    }
  });

  it("rejects replacement while the target floor owns live player state", async () => {
    const floors = createFloorRegistryFixture({ floors: [1] });
    try {
      floors.base.addPlayer({ name: "Live", clientId: "live-admin-apply" });
      await expect(floors.applyGeneratedFloor({ floor: 1, confirm: true })).resolves.toEqual({ ok: false, code: "floor_in_use" });
    } finally {
      await disposeFloorRegistryFixture(floors);
    }
  });

  it("rejects a preview identity that does not match the authoritative result", { timeout: 30_000 }, async () => {
    const floors = createFloorRegistryFixture({ floors: [1] });
    try {
      const expectedGeneration = floors.base.world.floorIdentity!;
      await expect(floors.applyGeneratedFloor({ floor: 2, confirm: true, expectedGeneration })).resolves.toEqual({
        ok: false,
        code: "generation_mismatch",
      });
    } finally {
      await disposeFloorRegistryFixture(floors);
    }
  });
});
