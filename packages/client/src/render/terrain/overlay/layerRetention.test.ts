import { describe, expect, it, vi } from "vitest";
import { pruneTerrainLayers } from "./layerRetention.js";

describe("pruneTerrainLayers", () => {
  it("destroys depth rows absent from the latest plan", () => {
    const retained = { destroy: vi.fn() };
    const stale = { destroy: vi.fn() };
    const layers = new Map([[10, retained], [20, stale]]);

    pruneTerrainLayers(layers, new Set([10]));

    expect([...layers.keys()]).toEqual([10]);
    expect(retained.destroy).not.toHaveBeenCalled();
    expect(stale.destroy).toHaveBeenCalledOnce();
  });
});
