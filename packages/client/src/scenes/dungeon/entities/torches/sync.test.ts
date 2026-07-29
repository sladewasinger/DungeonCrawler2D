import type { EntitySnapshot } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
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

describe("syncTorches", () => {
  it("uses the placed entity's exact anchor for both its sprite view and light", () => {
    const state = createTorchSyncState();
    const result = syncTorches({
      state,
      torches: [placedTorch()],
      terrain: {} as TerrainRendererLike,
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
  });

  it("removes the light in the same frame that the authoritative torch entity disappears", () => {
    const state = createTorchSyncState();
    syncTorches({
      state,
      torches: [placedTorch()],
      terrain: {} as TerrainRendererLike,
      serverTick: 100,
    });

    const afterRemoval = syncTorches({
      state,
      torches: [],
      terrain: {} as TerrainRendererLike,
      serverTick: 101,
    });

    expect(afterRemoval.views).toEqual([]);
    expect(afterRemoval.accentLights).toEqual([]);
  });
});
