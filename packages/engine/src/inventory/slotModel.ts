/** True 36-slot (9 hotbar + 27 backpack) inventory model enforcing maxStack=1 gear and optional prefixes. */
import type { ArmorSlotKey } from "@dc2d/contracts";

export type { ArmorSlotKey };

export const HOTBAR_SLOT_COUNT = 9;
export const BACKPACK_SLOT_COUNT = 27;
export const TOTAL_INVENTORY_SLOTS = HOTBAR_SLOT_COUNT + BACKPACK_SLOT_COUNT;

export interface SlotItem {
  readonly itemId: string;
  readonly count: number;
  readonly prefixId?: string | undefined;
}

export type InventorySlot = SlotItem | null;

export interface ArmorEquipment {
  readonly head: string | null;
  readonly chest: string | null;
  readonly legs: string | null;
  readonly feet: string | null;
  readonly offhand: string | null;
}

export type ArmorPrefixMap = {
  head?: string | undefined;
  chest?: string | undefined;
  legs?: string | undefined;
  feet?: string | undefined;
  offhand?: string | undefined;
};

export interface PlayerInventoryState {
  readonly slots: InventorySlot[];
  readonly armor: ArmorEquipment;
  readonly armorPrefixes?: ArmorPrefixMap | undefined;
}

export type StackLimitLookup = (itemId: string) => number;

export function makeSlotItem(itemId: string, count: number, prefixId?: string | undefined): SlotItem {
  return prefixId ? { itemId, count, prefixId } : { itemId, count };
}

export function createEmptyInventoryState(): PlayerInventoryState {
  return {
    slots: Array.from({ length: TOTAL_INVENTORY_SLOTS }, () => null),
    armor: { head: null, chest: null, legs: null, feet: null, offhand: null },
  };
}

function sameItemIdentity(a: SlotItem, itemId: string, prefixId?: string | undefined): boolean {
  return a.itemId === itemId && (a.prefixId ?? undefined) === (prefixId ?? undefined);
}

function fillExistingStacks(input: {
  readonly slots: InventorySlot[];
  readonly itemId: string;
  readonly prefixId?: string | undefined;
  readonly maxStack: number;
  readonly remaining: number;
}): number {
  let rem = input.remaining;
  if (input.maxStack <= 1) return rem;
  for (let i = 0; i < input.slots.length && rem > 0; i++) {
    const slot = input.slots[i];
    if (!slot || !sameItemIdentity(slot, input.itemId, input.prefixId) || slot.count >= input.maxStack) continue;
    const add = Math.min(rem, input.maxStack - slot.count);
    input.slots[i] = makeSlotItem(input.itemId, slot.count + add, input.prefixId);
    rem -= add;
  }
  return rem;
}

function fillEmptySlots(input: {
  readonly slots: InventorySlot[];
  readonly itemId: string;
  readonly prefixId?: string | undefined;
  readonly maxStack: number;
  readonly remaining: number;
}): number {
  let rem = input.remaining;
  for (let i = 0; i < input.slots.length && rem > 0; i++) {
    if (input.slots[i] !== null) continue;
    const add = Math.min(rem, input.maxStack);
    input.slots[i] = makeSlotItem(input.itemId, add, input.prefixId);
    rem -= add;
  }
  return rem;
}

/** Inserts item quantity across slots; maxStack=1 items always take 1 slot each. */
export function insertIntoSlots(
  slots: InventorySlot[],
  item: { readonly itemId: string; readonly count: number; readonly prefixId?: string | undefined },
  maxStackFor: StackLimitLookup,
): number {
  const maxStack = Math.max(1, maxStackFor(item.itemId));
  let remaining = Math.max(0, Math.floor(item.count));
  remaining = fillExistingStacks({ slots, itemId: item.itemId, prefixId: item.prefixId, maxStack, remaining });
  remaining = fillEmptySlots({ slots, itemId: item.itemId, prefixId: item.prefixId, maxStack, remaining });
  return item.count - remaining;
}

/** Returns true if at least one unit of `itemId` can fit into `slots`. */
export function canInsertSlotItem(
  slots: readonly InventorySlot[],
  itemId: string | { readonly itemId: string; readonly prefixId?: string | undefined },
  maxStackFor: StackLimitLookup,
): boolean {
  const id = typeof itemId === "string" ? itemId : itemId.itemId;
  const prefixId = typeof itemId === "string" ? undefined : itemId.prefixId;
  const maxStack = Math.max(1, maxStackFor(id));
  return slots.some((slot) => slot === null || (maxStack > 1 && sameItemIdentity(slot, id, prefixId) && slot.count < maxStack));
}

/** Removes up to `count` (or whole stack if omitted) from `slotIndex` and returns what was removed. */
export function removeFromSlot(slots: InventorySlot[], slotIndex: number, count?: number): SlotItem | null {
  if (!isValidSlotIndex(slotIndex, slots.length)) return null;
  const cur = slots[slotIndex];
  if (!cur) return null;
  const take = count === undefined ? cur.count : Math.min(cur.count, Math.max(1, Math.floor(count)));
  slots[slotIndex] = cur.count > take ? makeSlotItem(cur.itemId, cur.count - take, cur.prefixId) : null;
  return makeSlotItem(cur.itemId, take, cur.prefixId);
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
  if (!sameItemIdentity(dst, src.itemId, src.prefixId) || maxStack <= 1 || dst.count >= maxStack) return false;
  const moved = Math.min(src.count, maxStack - dst.count);
  slots[move.to] = makeSlotItem(dst.itemId, dst.count + moved, dst.prefixId);
  slots[move.from] = src.count > moved ? makeSlotItem(src.itemId, src.count - moved, src.prefixId) : null;
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
    slots[i] = slot.count > take ? makeSlotItem(itemId, slot.count - take, slot.prefixId) : null;
    remaining -= take;
  }
  return true;
}
