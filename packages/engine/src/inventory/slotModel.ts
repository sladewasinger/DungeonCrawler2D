/** True 36-slot (9 hotbar + 27 backpack) inventory model enforcing maxStack=1 gear. */

export const HOTBAR_SLOT_COUNT = 9;
export const BACKPACK_SLOT_COUNT = 27;
export const TOTAL_INVENTORY_SLOTS = HOTBAR_SLOT_COUNT + BACKPACK_SLOT_COUNT;

export type ArmorSlotKey = "head" | "chest" | "legs" | "feet" | "offhand";

export interface SlotItem {
  readonly itemId: string;
  readonly count: number;
}

export type InventorySlot = SlotItem | null;

export interface ArmorEquipment {
  readonly head: string | null;
  readonly chest: string | null;
  readonly legs: string | null;
  readonly feet: string | null;
  readonly offhand: string | null;
}

export interface PlayerInventoryState {
  readonly slots: InventorySlot[];
  readonly armor: ArmorEquipment;
}

export type StackLimitLookup = (itemId: string) => number;

export function createEmptyInventoryState(): PlayerInventoryState {
  return {
    slots: Array.from({ length: TOTAL_INVENTORY_SLOTS }, () => null),
    armor: { head: null, chest: null, legs: null, feet: null, offhand: null },
  };
}

function fillExistingStacks(input: {
  readonly slots: InventorySlot[];
  readonly itemId: string;
  readonly maxStack: number;
  readonly remaining: number;
}): number {
  let rem = input.remaining;
  if (input.maxStack <= 1) return rem;
  for (let i = 0; i < input.slots.length && rem > 0; i++) {
    const slot = input.slots[i];
    if (!slot || slot.itemId !== input.itemId || slot.count >= input.maxStack) continue;
    const add = Math.min(rem, input.maxStack - slot.count);
    input.slots[i] = { itemId: input.itemId, count: slot.count + add };
    rem -= add;
  }
  return rem;
}

function fillEmptySlots(input: {
  readonly slots: InventorySlot[];
  readonly itemId: string;
  readonly maxStack: number;
  readonly remaining: number;
}): number {
  let rem = input.remaining;
  for (let i = 0; i < input.slots.length && rem > 0; i++) {
    if (input.slots[i] !== null) continue;
    const add = Math.min(rem, input.maxStack);
    input.slots[i] = { itemId: input.itemId, count: add };
    rem -= add;
  }
  return rem;
}

/** Inserts item quantity across slots; maxStack=1 items always take 1 slot each. */
export function insertIntoSlots(
  slots: InventorySlot[],
  item: { readonly itemId: string; readonly count: number },
  maxStackFor: StackLimitLookup,
): number {
  const maxStack = Math.max(1, maxStackFor(item.itemId));
  let remaining = Math.max(0, Math.floor(item.count));
  remaining = fillExistingStacks({ slots, itemId: item.itemId, maxStack, remaining });
  remaining = fillEmptySlots({ slots, itemId: item.itemId, maxStack, remaining });
  return item.count - remaining;
}

function isValidSlotIndex(index: number, length: number): boolean {
  return index >= 0 && index < length;
}

function tryMergeStack(input: {
  readonly slots: InventorySlot[];
  readonly move: { readonly from: number; readonly to: number };
  readonly src: SlotItem;
  readonly dst: SlotItem;
  readonly maxStack: number;
}): boolean {
  const { slots, move, src, dst, maxStack } = input;
  if (dst.itemId !== src.itemId || maxStack <= 1 || dst.count >= maxStack) return false;
  const moved = Math.min(src.count, maxStack - dst.count);
  slots[move.to] = { itemId: dst.itemId, count: dst.count + moved };
  slots[move.from] = src.count > moved ? { itemId: src.itemId, count: src.count - moved } : null;
  return true;
}

function isValidMove(slots: InventorySlot[], move: { readonly from: number; readonly to: number }): boolean {
  if (move.from === move.to) return false;
  return isValidSlotIndex(move.from, slots.length) && isValidSlotIndex(move.to, slots.length);
}

/** Moves, merges (up to maxStack), or swaps between any two indices in [0..35]. */
export function moveOrSwapSlot(
  slots: InventorySlot[],
  move: { readonly from: number; readonly to: number },
  maxStackFor: StackLimitLookup,
): boolean {
  if (!isValidMove(slots, move)) return false;
  const src = slots[move.from];
  if (!src) return false;
  const dst = slots[move.to];
  if (dst && tryMergeStack({ slots, move, src, dst, maxStack: Math.max(1, maxStackFor(src.itemId)) })) {
    return true;
  }
  slots[move.to] = src;
  slots[move.from] = dst ?? null;
  return true;
}

function countSlotItem(slots: readonly InventorySlot[], itemId: string): number {
  let total = 0;
  for (const s of slots) if (s?.itemId === itemId) total += s.count;
  return total;
}

/** Consumes `count` units of `itemId` across matching slots, returning false if insufficient. */
export function consumeItemFromSlots(slots: InventorySlot[], itemId: string, count = 1): boolean {
  let remaining = Math.max(1, Math.floor(count));
  if (countSlotItem(slots, itemId) < remaining) return false;
  for (let i = 0; i < slots.length && remaining > 0; i++) {
    const slot = slots[i];
    if (slot?.itemId !== itemId) continue;
    const take = Math.min(remaining, slot.count);
    slots[i] = slot.count > take ? { itemId, count: slot.count - take } : null;
    remaining -= take;
  }
  return true;
}
