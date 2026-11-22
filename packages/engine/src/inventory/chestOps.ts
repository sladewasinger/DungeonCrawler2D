/** Pure 27-slot bidirectional chest transfer, quick-move, and Take All helpers. */
import {
  insertIntoSlots, moveOrSwapSlot, type InventorySlot, type SlotItem, type StackLimitLookup,
} from "./slotModel.js";

export const CHEST_SLOT_COUNT = 27;

export function createEmptyChestSlots(): InventorySlot[] {
  return Array.from({ length: CHEST_SLOT_COUNT }, () => null);
}

function tryCrossMerge(opts: {
  readonly srcList: InventorySlot[]; readonly dstList: InventorySlot[];
  readonly fromSlot: number; readonly toSlot: number;
  readonly src: SlotItem; readonly dst: SlotItem; readonly maxStack: number;
}): boolean {
  if (opts.dst.itemId !== opts.src.itemId || opts.maxStack <= 1 || opts.dst.count >= opts.maxStack) return false;
  const moved = Math.min(opts.src.count, opts.maxStack - opts.dst.count);
  opts.dstList[opts.toSlot] = { itemId: opts.dst.itemId, count: opts.dst.count + moved };
  opts.srcList[opts.fromSlot] = opts.src.count > moved ? { itemId: opts.src.itemId, count: opts.src.count - moved } : null;
  return true;
}

function swapCrossContainer(opts: {
  readonly srcList: InventorySlot[]; readonly dstList: InventorySlot[];
  readonly fromSlot: number; readonly toSlot: number; readonly maxStackFor: StackLimitLookup;
}): boolean {
  const src = opts.srcList[opts.fromSlot];
  if (!src) return false;
  const dst = opts.dstList[opts.toSlot];
  if (dst && tryCrossMerge({ ...opts, src, dst, maxStack: Math.max(1, opts.maxStackFor(src.itemId)) })) return true;
  opts.dstList[opts.toSlot] = src;
  opts.srcList[opts.fromSlot] = dst ?? null;
  return true;
}

export function transferChestSlot(opts: {
  readonly chestSlots: InventorySlot[]; readonly invSlots: InventorySlot[];
  readonly from: "chest" | "inv"; readonly fromSlot: number;
  readonly to: "chest" | "inv"; readonly toSlot: number;
  readonly maxStackFor: StackLimitLookup;
}): boolean {
  const srcList = opts.from === "chest" ? opts.chestSlots : opts.invSlots;
  const dstList = opts.to === "chest" ? opts.chestSlots : opts.invSlots;
  if (opts.from === opts.to) return moveOrSwapSlot(srcList, { from: opts.fromSlot, to: opts.toSlot }, opts.maxStackFor);
  const badSrc = opts.fromSlot < 0 || opts.fromSlot >= srcList.length;
  const badDst = opts.toSlot < 0 || opts.toSlot >= dstList.length;
  if (badSrc || badDst) return false;
  return swapCrossContainer({ srcList, dstList, fromSlot: opts.fromSlot, toSlot: opts.toSlot, maxStackFor: opts.maxStackFor });
}

export function quickTransferChestSlot(opts: {
  readonly chestSlots: InventorySlot[]; readonly invSlots: InventorySlot[];
  readonly from: "chest" | "inv"; readonly slotIndex: number; readonly maxStackFor: StackLimitLookup;
}): boolean {
  const srcList = opts.from === "chest" ? opts.chestSlots : opts.invSlots;
  const dstList = opts.from === "chest" ? opts.invSlots : opts.chestSlots;
  if (opts.slotIndex < 0 || opts.slotIndex >= srcList.length) return false;
  const src = srcList[opts.slotIndex];
  if (!src) return false;
  const moved = insertIntoSlots(dstList, src, opts.maxStackFor);
  if (moved <= 0) return false;
  srcList[opts.slotIndex] = src.count > moved ? { itemId: src.itemId, count: src.count - moved } : null;
  return true;
}

export function takeAllFromChest(opts: {
  readonly chestSlots: InventorySlot[]; readonly invSlots: InventorySlot[]; readonly maxStackFor: StackLimitLookup;
}): number {
  let totalMoved = 0;
  for (let i = 0; i < opts.chestSlots.length; i++) {
    const item = opts.chestSlots[i];
    if (!item) continue;
    const moved = insertIntoSlots(opts.invSlots, item, opts.maxStackFor);
    if (moved <= 0) continue;
    totalMoved += moved;
    opts.chestSlots[i] = item.count > moved ? { itemId: item.itemId, count: item.count - moved } : null;
  }
  return totalMoved;
}
