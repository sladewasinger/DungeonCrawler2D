import { isBowItem, isShieldItem } from "@dc2d/content";
import { createEmptyChestSlots, TOTAL_INVENTORY_SLOTS } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { resolvePendingGate } from "./actionGate.js";
import { applyChestTakeAll, applyChestTransfer, createStarterInventorySnapshot, reconcileInventorySnapshot } from "./clientInventory.js";
import { createDefaultPlayer, reconcilePredictedPlayer } from "./worldPrediction.js";

describe("reconcileInventorySnapshot", () => {
  it("equips starter chest, legs, and feet armor without helmet and starts with wooden-spear only", () => {
    const starter = createStarterInventorySnapshot();
    expect(starter.slots[0]).toEqual({ itemId: "wooden-spear", count: 1 });
    expect(starter.slots.slice(1).every((s) => s === null)).toBe(true);
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

  it("identifies all frontier bows and shields generically and reports changed=false on full-bag chest transfers", () => {
    expect(isBowItem("bow")).toBe(true);
    expect(isBowItem("amber-recurve-bow")).toBe(true);
    expect(isBowItem("whisperwind-bow")).toBe(true);
    expect(isBowItem("sword")).toBe(false);

    expect(isShieldItem("wooden-shield")).toBe(true);
    expect(isShieldItem("reinforced-shield")).toBe(true);
    expect(isShieldItem("runic-buckler")).toBe(true);
    expect(isShieldItem("aegis-tower-shield")).toBe(true);
    expect(isShieldItem("leather-tunic")).toBe(false);

    const fullSlots = Array.from({ length: TOTAL_INVENTORY_SLOTS }, () => ({ itemId: "sword", count: 1 }));
    const inv = { ...createStarterInventorySnapshot(), slots: fullSlots };
    const chestSlots = createEmptyChestSlots();
    chestSlots[0] = { itemId: "copper-sword", count: 1 };
    const chest = { id: "c1", poiKind: "bandit-camp", x: 0, y: 0, elevation: 0, opened: false, slots: chestSlots };

    expect(applyChestTakeAll({ inv, chest }).changed).toBe(false);
    expect(applyChestTransfer({ inv, chest, from: "chest", fromSlot: 0, to: "inv", toSlot: 0, quick: true }).changed).toBe(false);

    const unlockedInv = { ...inv, slots: fullSlots.map((s, idx) => (idx === 10 ? null : s)) };
    const took = applyChestTransfer({ inv: unlockedInv, chest, from: "chest", fromSlot: 0, to: "inv", toSlot: 0, quick: true });
    expect(took.changed).toBe(true);
    expect(took.inv.slots[10]?.itemId).toBe("copper-sword");
    expect(took.chest.slots[0]).toBeNull();

    const gateCleared = resolvePendingGate({ pendingSeq: 5, atMs: 100 }, { serverAck: 5, nowMs: 120 });
    expect(gateCleared.accept).toBe(true);
    expect(gateCleared.nextGate.pendingSeq).toBe(0);
  });

  it("propagates and clears activeBubble on the local predicted player within small reconciliation gaps", () => {
    const local = createDefaultPlayer("p1");
    const withBubble = reconcilePredictedPlayer(local, {
      ...local,
      activeBubble: { text: "Frontier Chat Works!", remainingSec: 4.5, shout: false },
    });
    expect(withBubble.activeBubble?.text).toBe("Frontier Chat Works!");

    const cleared = reconcilePredictedPlayer(withBubble, { ...local });
    expect(cleared.activeBubble).toBeUndefined();
  });
});
