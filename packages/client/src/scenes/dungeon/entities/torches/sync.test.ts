import type { EntitySnapshot } from "@dc2d/engine";
import { describe, expect, it, vi } from "vitest";
import type { InterpolatedEntity } from "../../../../net/interpolation/interpolate.js";
import type { TerrainRendererLike } from "../../../../render/terrain/index.js";
import { createTorchSyncState, syncTorches } from "./sync.js";

function placedTorch(): InterpolatedEntity {
  const snap: EntitySnapshot = {
    id: "torch-1",
    kind: "torch",
    defId: "torch",
    x: 4.25,
    y: 6.75,
    z: 2,
    state: "placed",
    expiresAtTick: 500,
  };
  return { id: snap.id, snap, x: snap.x, y: snap.y, z: snap.z };
}

function terrainMock(): TerrainRendererLike {
  return {
    update: vi.fn(),
    setDynamicLights: vi.fn(),
    rebuildAffected: vi.fn(),
    rebakeAllNow: vi.fn(),
    invalidateAll: vi.fn(),
    dispose: vi.fn(),
  };
}

describe("syncTorches", () => {
  it("uses the placed entity's exact anchor for both its sprite view and light", () => {
    const state = createTorchSyncState();
    const terrain = terrainMock();
    const result = syncTorches({
      state,
      torches: [placedTorch()],
      terrain,
      serverTick: 100,
    });

    expect(result.views).toEqual([expect.objectContaining({
      id: "torch-1",
      x: 4.25,
      y: 6.75,
      z: 2,
      state: "placed",
    })]);
    expect(result.accentLights).toEqual([expect.objectContaining({
      id: "torch-placed:torch-1",
      x: 4.25,
      y: 6.75,
      groundHeight: 2,
      kind: "torch",
    })]);
    expect(terrain.setDynamicLights).toHaveBeenCalledOnce();
  });

  it("removes the light in the same frame that the authoritative torch entity disappears", () => {
    const state = createTorchSyncState();
    const terrain = terrainMock();
    syncTorches({
      state,
      torches: [placedTorch()],
      terrain,
      serverTick: 100,
    });
    vi.mocked(terrain.rebuildAffected).mockClear();

    const afterRemoval = syncTorches({
      state,
      torches: [],
      terrain,
      serverTick: 101,
    });

    expect(afterRemoval.views).toEqual([]);
    expect(afterRemoval.accentLights).toEqual([]);
    expect(terrain.rebuildAffected).toHaveBeenCalledOnce();
  });
});
