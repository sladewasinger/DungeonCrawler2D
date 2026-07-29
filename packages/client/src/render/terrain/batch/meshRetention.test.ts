import { describe, expect, it, vi } from "vitest";
import { pruneTerrainMeshes } from "./meshRetention.js";

describe("pruneTerrainMeshes", () => {
  it("keeps active submissions and destroys stale meshes", () => {
    const retained = { destroy: vi.fn(), setVisible: vi.fn() };
    const stale = { destroy: vi.fn(), setVisible: vi.fn() };
    const meshes = new Map([["retained", retained], ["stale", stale]]);

    pruneTerrainMeshes({
      meshes,
      active: new Set(["retained"]),
      visible: true,
    });

    expect([...meshes.keys()]).toEqual(["retained"]);
    expect(retained.setVisible).toHaveBeenCalledWith(true);
    expect(stale.destroy).toHaveBeenCalledOnce();
  });
});
