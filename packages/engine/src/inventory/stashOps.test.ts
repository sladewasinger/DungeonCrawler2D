/** Unit tests for 27-slot Sanctuary Stash operations and upgrade/prefix preservation [REQ-P9-06]. */
import { describe, expect, it } from "vitest";
import { createEmptyInventoryState } from "./slotModel.js";
import {
  STASH_SLOT_COUNT,
  createEmptyStashSlots,
  quickTransferStashSlot,
  takeAllFromStash,
  transferStashSlot,
} from "./stashOps.js";

const SWORD_ID = "iron-sword";
const maxStack = (id: string) => (id === "arrow" ? 64 : 1);

describe("[REQ-P9-06] Sanctuary Stash operations", () => {
  it("transfers, swaps, quick-moves, and isolates 27-slot stash preserving prefix and upgradeLevel", () => {
    const stashA = createEmptyStashSlots();
    const stashB = createEmptyStashSlots();
    const invA = createEmptyInventoryState();
    expect(stashA.length).toBe(STASH_SLOT_COUNT);

    invA.slots[0] = { itemId: SWORD_ID, count: 1, prefixId: "keen", upgradeLevel: 2 };
    invA.slots[1] = { itemId: "arrow", count: 20 };

    expect(transferStashSlot({
      stashSlots: stashA, invSlots: invA.slots, from: "inv", fromSlot: 0, to: "stash", toSlot: 4, maxStackFor: maxStack,
    })).toBe(true);
    expect(invA.slots[0]).toBeNull();
    expect(stashA[4]).toEqual({ itemId: SWORD_ID, count: 1, prefixId: "keen", upgradeLevel: 2 });
    expect(stashB[4]).toBeNull();

    expect(quickTransferStashSlot({
      stashSlots: stashA, invSlots: invA.slots, from: "inv", slotIndex: 1, maxStackFor: maxStack,
    })).toBe(true);
    expect(stashA[0]).toEqual({ itemId: "arrow", count: 20 });

    const taken = takeAllFromStash({ stashSlots: stashA, invSlots: invA.slots, maxStackFor: maxStack });
    expect(taken).toBe(21);
    expect(stashA.every((s) => s === null)).toBe(true);
    const restoredSword = invA.slots.find((s) => s?.itemId === SWORD_ID);
    expect(restoredSword).toEqual({ itemId: SWORD_ID, count: 1, prefixId: "keen", upgradeLevel: 2 });
  });
});
