import { describe, expect, it } from "vitest";
import {
  canInsertSlotItem, consumeItemFromSlots, createEmptyInventoryState, insertIntoSlots, moveOrSwapSlot, removeFromSlot,
} from "./slotModel.js";

const limitFor = (id: string): number => (id === "sword" || id === "bow" ? 1 : 64);

describe("slotModel", () => {
  it("never stacks equipable gear beyond count 1", () => {
    const inv = createEmptyInventoryState();
    const inserted = insertIntoSlots(inv.slots, { itemId: "sword", count: 2 }, limitFor);
    expect(inserted).toBe(2);
    expect(inv.slots[0]).toEqual({ itemId: "sword", count: 1 });
    expect(inv.slots[1]).toEqual({ itemId: "sword", count: 1 });
  });

  it("stacks stackables up to maxStack and supports hotbar/backpack moves", () => {
    const inv = createEmptyInventoryState();
    insertIntoSlots(inv.slots, { itemId: "torch", count: 4 }, limitFor);
    insertIntoSlots(inv.slots, { itemId: "torch", count: 5 }, limitFor);
    expect(inv.slots[0]).toEqual({ itemId: "torch", count: 9 });
    expect(moveOrSwapSlot(inv.slots, { from: 0, to: 9 }, limitFor)).toBe(true);
    expect(inv.slots[0]).toBeNull();
    expect(inv.slots[9]).toEqual({ itemId: "torch", count: 9 });
    expect(consumeItemFromSlots(inv.slots, "torch", 10)).toBe(false);
    expect(consumeItemFromSlots(inv.slots, "torch", 4)).toBe(true);
    expect(inv.slots[9]).toEqual({ itemId: "torch", count: 5 });
  });

  it("checks insert capacity and removes partial or full stacks from slots", () => {
    const inv = createEmptyInventoryState();
    for (let i = 0; i < inv.slots.length; i++) inv.slots[i] = { itemId: "stone", count: 64 };
    expect(canInsertSlotItem(inv.slots, "stone", limitFor)).toBe(false);
    expect(canInsertSlotItem(inv.slots, "wood", limitFor)).toBe(false);

    const partial = removeFromSlot(inv.slots, 0, 10);
    expect(partial).toEqual({ itemId: "stone", count: 10 });
    expect(inv.slots[0]).toEqual({ itemId: "stone", count: 54 });
    expect(canInsertSlotItem(inv.slots, "stone", limitFor)).toBe(true);
    expect(canInsertSlotItem(inv.slots, "wood", limitFor)).toBe(false);

    expect(removeFromSlot(inv.slots, 0)).toEqual({ itemId: "stone", count: 54 });
    expect(inv.slots[0]).toBeNull();
    expect(canInsertSlotItem(inv.slots, "wood", limitFor)).toBe(true);
  });
});
