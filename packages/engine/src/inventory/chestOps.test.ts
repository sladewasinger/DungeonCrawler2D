import { describe, expect, it } from "vitest";
import {
  CHEST_SLOT_COUNT, createEmptyChestSlots, quickTransferChestSlot, takeAllFromChest, transferChestSlot,
} from "./chestOps.js";
import { createEmptyInventoryState } from "./slotModel.js";

const maxStack = (id: string) => (id === "sword" ? 1 : 16);

describe("chestOps", () => {
  it("transfers, merges stacks, and swaps gear bidirectionally between chest and inventory", () => {
    const chest = createEmptyChestSlots();
    const inv = createEmptyInventoryState().slots;
    expect(chest).toHaveLength(CHEST_SLOT_COUNT);
    chest[0] = { itemId: "bandage", count: 5 };
    inv[9] = { itemId: "bandage", count: 14 };
    expect(transferChestSlot({ chestSlots: chest, invSlots: inv, from: "chest", fromSlot: 0, to: "inv", toSlot: 9, maxStackFor: maxStack })).toBe(true);
    expect(inv[9]).toEqual({ itemId: "bandage", count: 16 });
    expect(chest[0]).toEqual({ itemId: "bandage", count: 3 });

    inv[10] = { itemId: "sword", count: 1 };
    expect(transferChestSlot({ chestSlots: chest, invSlots: inv, from: "inv", fromSlot: 10, to: "chest", toSlot: 1, maxStackFor: maxStack })).toBe(true);
    expect(chest[1]).toEqual({ itemId: "sword", count: 1 });
    expect(inv[10]).toBeNull();
  });

  it("supports Shift-click quick transfer and Take All respecting full inventory overflow", () => {
    const chest = createEmptyChestSlots();
    const inv = createEmptyInventoryState().slots;
    chest[0] = { itemId: "torch", count: 4 };
    chest[1] = { itemId: "sword", count: 1 };
    expect(quickTransferChestSlot({ chestSlots: chest, invSlots: inv, from: "chest", slotIndex: 0, maxStackFor: maxStack })).toBe(true);
    expect(inv[0]).toEqual({ itemId: "torch", count: 4 });
    expect(chest[0]).toBeNull();

    expect(quickTransferChestSlot({ chestSlots: chest, invSlots: inv, from: "inv", slotIndex: 0, maxStackFor: maxStack })).toBe(true);
    expect(chest[0]).toEqual({ itemId: "torch", count: 4 });
    expect(inv[0]).toBeNull();

    const moved = takeAllFromChest({ chestSlots: chest, invSlots: inv, maxStackFor: maxStack });
    expect(moved).toBe(5);
    expect(chest.every((s) => s === null)).toBe(true);
  });
});
