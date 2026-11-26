/** Pure 27-slot cross-floor Sanctuary Stash container transfer, quick-move, and Take All helpers [REQ-P9-06]. */
import { quickTransferChestSlot, takeAllFromChest, transferChestSlot } from "./chestOps.js";
import type { InventorySlot, StackLimitLookup } from "./slotModel.js";

export const STASH_SLOT_COUNT = 27;

export function createEmptyStashSlots(): InventorySlot[] {
  return Array.from({ length: STASH_SLOT_COUNT }, () => null);
}

export function transferStashSlot(opts: {
  readonly stashSlots: InventorySlot[];
  readonly invSlots: InventorySlot[];
  readonly from: "stash" | "inv";
  readonly fromSlot: number;
  readonly to: "stash" | "inv";
  readonly toSlot: number;
  readonly maxStackFor: StackLimitLookup;
}): boolean {
  return transferChestSlot({
    chestSlots: opts.stashSlots,
    invSlots: opts.invSlots,
    from: opts.from === "stash" ? "chest" : "inv",
    fromSlot: opts.fromSlot,
    to: opts.to === "stash" ? "chest" : "inv",
    toSlot: opts.toSlot,
    maxStackFor: opts.maxStackFor,
  });
}

export function quickTransferStashSlot(opts: {
  readonly stashSlots: InventorySlot[];
  readonly invSlots: InventorySlot[];
  readonly from: "stash" | "inv";
  readonly slotIndex: number;
  readonly maxStackFor: StackLimitLookup;
}): boolean {
  return quickTransferChestSlot({
    chestSlots: opts.stashSlots,
    invSlots: opts.invSlots,
    from: opts.from === "stash" ? "chest" : "inv",
    slotIndex: opts.slotIndex,
    maxStackFor: opts.maxStackFor,
  });
}

export function takeAllFromStash(opts: {
  readonly stashSlots: InventorySlot[];
  readonly invSlots: InventorySlot[];
  readonly maxStackFor: StackLimitLookup;
}): number {
  return takeAllFromChest({
    chestSlots: opts.stashSlots,
    invSlots: opts.invSlots,
    maxStackFor: opts.maxStackFor,
  });
}
