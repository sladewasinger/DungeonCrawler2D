import type { EntitySnapshot } from "@dc2d/engine";
import { describe, expect, it, vi } from "vitest";
import type { TerrainRenderer } from "../../render/terrain/index.js";
import type { InterpolatedEntity } from "./entityViews.js";
import { createTorchSyncState, syncTorches } from "./torchSync.js";

function torch(
  id: string,
  state: "flying" | "placed",
  x: number,
  y: number,
): InterpolatedEntity {
  const snap: EntitySnapshot = {
    id,
    kind: "torch",
    state,
    x,
    y,
    z: 0,
    expiresAtTick: 1000,
  };
  return { id, snap, x, y, z: 0 };
}

function terrainProbe() {
  return {
    setDynamicLights: vi.fn(),
    rebuildAffected: vi.fn(),
  };
}

describe("syncTorches", () => {
  it("reuses synchronous frame buffers and updates retained terrain seeds only on change", () => {
    const state = createTorchSyncState();
    const terrain = terrainProbe();
    const placed = torch("p", "placed", 4.5, 6.5);
    const flying = torch("f", "flying", 2, 3);
    const first = syncTorches(
      state,
      [placed, flying],
      terrain as unknown as TerrainRenderer,
      100,
    );
    const views = first.views;
    const viewRecords = [...first.views];
    const accentLights = first.accentLights;

    for (let frame = 0; frame < 300; frame++) {
      const result = syncTorches(
        state,
        [placed, flying],
        terrain as unknown as TerrainRenderer,
        100 + frame,
      );
      expect(result).toBe(first);
      expect(result.views).toBe(views);
      expect(result.views).toEqual(viewRecords);
      expect(result.views[0]).toBe(viewRecords[0]);
      expect(result.views[1]).toBe(viewRecords[1]);
      expect(result.accentLights).toBe(accentLights);
    }

    expect(terrain.setDynamicLights).toHaveBeenCalledTimes(1);
    expect(terrain.rebuildAffected).toHaveBeenCalledTimes(1);

    syncTorches(
      state,
      [flying],
      terrain as unknown as TerrainRenderer,
      500,
    );

    expect(terrain.setDynamicLights).toHaveBeenCalledTimes(2);
    expect(terrain.setDynamicLights).toHaveBeenLastCalledWith([]);
    expect(terrain.rebuildAffected).toHaveBeenCalledTimes(2);
  });

  it("publishes current placed lights to a replacement terrain instance", () => {
    const state = createTorchSyncState();
    const firstTerrain = terrainProbe();
    const nextTerrain = terrainProbe();
    const placed = torch("p", "placed", 4.5, 6.5);
    syncTorches(
      state,
      [placed],
      firstTerrain as unknown as TerrainRenderer,
      100,
    );

    syncTorches(
      state,
      [placed],
      nextTerrain as unknown as TerrainRenderer,
      101,
    );

    expect(nextTerrain.setDynamicLights).toHaveBeenCalledOnce();
    expect(nextTerrain.setDynamicLights).toHaveBeenCalledWith([
      { tileX: 4, tileY: 6, level: expect.any(Number) },
    ]);
  });
});
