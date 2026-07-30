import { describe, expect, it, vi } from "vitest";
import { TerrainAtlasBatchRenderer } from "./atlasBatch.js";

describe("TerrainAtlasBatchRenderer visibility", () => {
  it("skips repeated visibility traversal while preserving every child", () => {
    const activeMesh = { setVisible: vi.fn() };
    const inactiveMesh = { setVisible: vi.fn() };
    const aoOverlay = { setVisible: vi.fn() };
    const cliffHighlight = { setVisible: vi.fn() };
    const surfaceTint = { setVisible: vi.fn() };
    const batch = {
      visible: true,
      meshes: new Map([["active", activeMesh], ["inactive", inactiveMesh]]),
      active: new Set(["active"]),
      aoOverlay,
      cliffHighlight,
      surfaceTint,
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
    expect(aoOverlay.setVisible).toHaveBeenNthCalledWith(1, false);
    expect(aoOverlay.setVisible).toHaveBeenNthCalledWith(2, true);
    expect(aoOverlay.setVisible).toHaveBeenCalledTimes(2);
    expect(cliffHighlight.setVisible).toHaveBeenNthCalledWith(1, false);
    expect(cliffHighlight.setVisible).toHaveBeenNthCalledWith(2, true);
    expect(cliffHighlight.setVisible).toHaveBeenCalledTimes(2);
    expect(surfaceTint.setVisible).toHaveBeenNthCalledWith(1, false);
    expect(surfaceTint.setVisible).toHaveBeenNthCalledWith(2, true);
    expect(surfaceTint.setVisible).toHaveBeenCalledTimes(2);
  });
});
