import { describe, expect, it, vi } from "vitest";
import { TerrainAtlasBatchRenderer } from "./atlasBatch.js";

describe("TerrainAtlasBatchRenderer visibility", () => {
  it("skips repeated visibility traversal while preserving every child", () => {
    const activeMesh = { setVisible: vi.fn() };
    const inactiveMesh = { setVisible: vi.fn() };
    const overlayLayers = { setVisible: vi.fn() };
    const batch = {
      visible: true,
      meshes: new Map([["active", activeMesh], ["inactive", inactiveMesh]]),
      active: new Set(["active"]),
      overlayLayers,
    };

    TerrainAtlasBatchRenderer.prototype.setVisible.call(batch, false);
    TerrainAtlasBatchRenderer.prototype.setVisible.call(batch, false);
    TerrainAtlasBatchRenderer.prototype.setVisible.call(batch, true);
    TerrainAtlasBatchRenderer.prototype.setVisible.call(batch, true);

    expect(activeMesh.setVisible).toHaveBeenNthCalledWith(1, false);
    expect(activeMesh.setVisible).toHaveBeenNthCalledWith(2, true);
    expect(activeMesh.setVisible).toHaveBeenCalledTimes(2);
    expect(inactiveMesh.setVisible).toHaveBeenCalledWith(false);
    expect(inactiveMesh.setVisible).toHaveBeenCalledTimes(2);
    expect(overlayLayers.setVisible).toHaveBeenNthCalledWith(1, false);
    expect(overlayLayers.setVisible).toHaveBeenNthCalledWith(2, true);
    expect(overlayLayers.setVisible).toHaveBeenCalledTimes(2);
  });
});
