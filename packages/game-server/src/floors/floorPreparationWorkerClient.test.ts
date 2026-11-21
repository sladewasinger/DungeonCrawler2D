import { describe, expect, it } from "vitest";
import { FloorPreparationWorkerClient } from "./floorPreparationWorkerClient.js";

describe("FloorPreparationWorkerClient", () => {
  it("returns an authoritative floor and encoded artifact, then idles", { timeout: 30_000 }, async () => {
    const client = new FloorPreparationWorkerClient();
    try {
      const result = await client.prepare({
        worldSeed: 24601,
        floor: 2,
        voidTerrain: true,
      });

      expect(result.floor.floor).toBe(2);
      expect(result.floor.worldSeed).toBe(24601);
      expect(result.artifact).toMatch(/^gzip-base64-v1:/);
    } finally {
      await client.dispose();
    }
  });
});
