import { describe, expect, it } from "vitest";
import { createEmptyInventoryState, insertIntoSlots, moveOrSwapSlot } from "./slotModel.js";

const limitFor = (id: string): number => (id === "sword" || id === "bow" ? 1 : 32);

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
  });
});
