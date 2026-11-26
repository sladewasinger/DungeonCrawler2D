import { describe, expect, it } from "vitest";
import { createStarterInventorySnapshot } from "./clientInventory.js";
import {
  OfflineWorldSaver, clearOfflineWorldState, loadOfflineWorldState,
  offlineWorldStorageKey, saveOfflineWorldState, type OfflineWorldSnapshot, type StorageLike,
} from "./offlinePersistence.js";

function createMemoryStorage(): StorageLike & { readonly data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, v); },
    removeItem: (k) => { data.delete(k); },
  };
}

function makeSampleSnapshot(seed = 1337): OfflineWorldSnapshot {
  return {
    version: 1,
    worldSeed: seed,
    dayPhase: 0.42,
    depleted: [{ propId: "0:0:tree:1", replacementKind: "stump", regrowAtSec: 250 }],
    structures: [{ id: "struct-1", kind: "bed", itemId: "camp-bed", x: 14, y: 2, elevation: 0, ownerName: "hero", rotation: 2 }],
    beds: [{ ownerKey: "hero", structureId: "struct-1", x: 14, y: 2, elevation: 0 }],
    chests: [{ id: "struct-2", poiKind: "player-chest", x: 15, y: 2, elevation: 0, opened: false, slots: Array.from({ length: 27 }, () => null) }],
    player: {
      x: 13.5, y: 2.5, elevation: 0, inventory: createStarterInventorySnapshot(),
      wellFedTimer: 210, invigoratedTimer: 165, restedTimer: 290, hotTimer: 3.5,
    },
  };
}

describe("offlinePersistence localStorage snapshots", () => {
  it("[REQ-P8-17] serializes and restores depleted nodes, structures, beds, chests, inventory, and buff timers", () => {
    const store = createMemoryStorage();
    const snap = makeSampleSnapshot(1337);
    expect(saveOfflineWorldState(snap, store)).toBe(true);
    expect(store.data.has(offlineWorldStorageKey(1337))).toBe(true);

    const loaded = loadOfflineWorldState(1337, store);
    expect(loaded).toEqual(snap);
    expect(loadOfflineWorldState(9999, store)).toBeNull();

    const saver = new OfflineWorldSaver(store);
    saver.markDirty();
    expect(saver.maybeFlush(1000, () => snap)).toBe(false);
    expect(saver.maybeFlush(6001, () => snap)).toBe(true);
    expect(saver.isDirty()).toBe(false);

    clearOfflineWorldState(1337, store);
    expect(loadOfflineWorldState(1337, store)).toBeNull();
  });
});
