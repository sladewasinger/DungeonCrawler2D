/** Per-account 27-slot cross-floor Sanctuary Stash manager with strict player isolation [REQ-P9-06]. */
import { maxStackForItem } from "@dc2d/content";
import {
  STASH_SLOT_COUNT,
  createEmptyStashSlots,
  makeSlotItem,
  quickTransferStashSlot,
  takeAllFromStash,
  transferStashSlot,
  type InventorySlot,
} from "@dc2d/engine";

function sanitizeSlot(slot: InventorySlot | undefined): InventorySlot {
  if (!slot || typeof slot.itemId !== "string" || slot.count <= 0) return null;
  return makeSlotItem(slot.itemId, slot.count, { prefixId: slot.prefixId, upgradeLevel: slot.upgradeLevel });
}

export class StashManager {
  private readonly byAccount = new Map<string, InventorySlot[]>();

  getSlots(accountId: string): InventorySlot[] {
    let slots = this.byAccount.get(accountId);
    if (!slots) {
      slots = createEmptyStashSlots();
      this.byAccount.set(accountId, slots);
    }
    return slots;
  }

  snapshot(accountId: string): InventorySlot[] {
    return this.getSlots(accountId).map((s) => sanitizeSlot(s));
  }

  hydrate(accountId: string, saved?: readonly InventorySlot[] | undefined): void {
    const target = createEmptyStashSlots();
    if (saved) {
      const limit = Math.min(STASH_SLOT_COUNT, saved.length);
      for (let i = 0; i < limit; i++) target[i] = sanitizeSlot(saved[i]);
    }
    this.byAccount.set(accountId, target);
  }

  transfer(opts: {
    readonly accountId: string;
    readonly invSlots: InventorySlot[];
    readonly from: "stash" | "inv";
    readonly fromSlot: number;
    readonly to: "stash" | "inv";
    readonly toSlot: number;
  }): boolean {
    const stashSlots = this.getSlots(opts.accountId);
    return transferStashSlot({
      stashSlots,
      invSlots: opts.invSlots,
      from: opts.from,
      fromSlot: opts.fromSlot,
      to: opts.to,
      toSlot: opts.toSlot,
      maxStackFor: maxStackForItem,
    });
  }

  quickMove(opts: {
    readonly accountId: string;
    readonly invSlots: InventorySlot[];
    readonly from: "stash" | "inv";
    readonly slotIndex: number;
  }): boolean {
    return quickTransferStashSlot({
      stashSlots: this.getSlots(opts.accountId),
      invSlots: opts.invSlots,
      from: opts.from,
      slotIndex: opts.slotIndex,
      maxStackFor: maxStackForItem,
    });
  }

  takeAll(opts: { readonly accountId: string; readonly invSlots: InventorySlot[] }): number {
    return takeAllFromStash({
      stashSlots: this.getSlots(opts.accountId),
      invSlots: opts.invSlots,
      maxStackFor: maxStackForItem,
    });
  }
}
