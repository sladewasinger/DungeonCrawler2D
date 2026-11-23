import { describe, expect, it } from "vitest";
import { createStarterInventorySnapshot, reconcileInventorySnapshot } from "./clientInventory.js";

describe("reconcileInventorySnapshot", () => {
  it("equips starter chest, legs, and feet armor without helmet by default", () => {
    const starter = createStarterInventorySnapshot();
    expect(starter.armor).toEqual({
      head: null,
      chest: "leather-tunic",
      legs: "leather-leggings",
      feet: "leather-boots",
      offhand: null,
    });
  });

  it("ignores stale pre-ack snapshots while preserving campfire updates", () => {
    const optimistic = { ...createStarterInventorySnapshot(), selectedHotbar: 1, nearCampfire: true };
    const staleServer = { ...createStarterInventorySnapshot(), selectedHotbar: 0, nearCampfire: false, ackSeq: 1 };

    const res = reconcileInventorySnapshot({
      current: optimistic,
      incoming: staleServer,
      pendingSeq: 2,
      elapsedMs: 120,
    });

    expect(res.clearedPending).toBe(false);
    expect(res.inventory.selectedHotbar).toBe(1);
    expect(res.inventory.nearCampfire).toBe(false);
  });

  it("commits server state once ackSeq catches up or after timeout", () => {
    const optimistic = { ...createStarterInventorySnapshot(), selectedHotbar: 2 };
    const caughtUp = { ...createStarterInventorySnapshot(), selectedHotbar: 2, ackSeq: 2 };

    const acked = reconcileInventorySnapshot({
      current: optimistic,
      incoming: caughtUp,
      pendingSeq: 2,
      elapsedMs: 50,
    });
    expect(acked.clearedPending).toBe(true);
    expect(acked.inventory.selectedHotbar).toBe(2);

    const staleTimedOut = { ...createStarterInventorySnapshot(), selectedHotbar: 0, ackSeq: 1 };
    const expired = reconcileInventorySnapshot({
      current: optimistic,
      incoming: staleTimedOut,
      pendingSeq: 2,
      elapsedMs: 1500,
    });
    expect(expired.clearedPending).toBe(true);
    expect(expired.inventory.selectedHotbar).toBe(0);
  });
});
