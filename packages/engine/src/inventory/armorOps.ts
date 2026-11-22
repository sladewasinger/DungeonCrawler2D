/** Pure armor equipment swap, unequip, and defense helpers for 36-slot inventory. */
import {
  insertIntoSlots,
  type ArmorEquipment,
  type ArmorSlotKey,
  type InventorySlot,
  type PlayerInventoryState,
  type StackLimitLookup,
} from "./slotModel.js";

export const ARMOR_SLOT_KEYS: readonly ArmorSlotKey[] = ["head", "chest", "legs", "feet"];

export interface ArmorItemRule {
  readonly armorSlot?: ArmorSlotKey | undefined;
  readonly defense?: number | undefined;
}

export type ArmorRuleLookup = (itemId: string) => ArmorItemRule | undefined;

export function cloneInventoryState(state: PlayerInventoryState): PlayerInventoryState {
  return {
    slots: state.slots.map((slot) => (slot ? { itemId: slot.itemId, count: slot.count } : null)),
    armor: { ...state.armor },
  };
}

function isValidSlot(index: number, slots: readonly InventorySlot[]): boolean {
  return Number.isInteger(index) && index >= 0 && index < slots.length;
}

/** Equips an armor item from `slotIndex` into its matching armor slot, swapping any previous piece back. */
export function equipArmorFromSlot(
  state: PlayerInventoryState,
  req: { readonly slotIndex: number; readonly targetArmor?: ArmorSlotKey | undefined },
  lookup: ArmorRuleLookup,
): PlayerInventoryState | null {
  if (!isValidSlot(req.slotIndex, state.slots)) return null;
  const source = state.slots[req.slotIndex];
  if (!source) return null;
  const itemSlot = lookup(source.itemId)?.armorSlot;
  if (!itemSlot || (req.targetArmor && req.targetArmor !== itemSlot)) return null;

  const next = cloneInventoryState(state);
  const previousId = next.armor[itemSlot];
  next.slots[req.slotIndex] = previousId ? { itemId: previousId, count: 1 } : null;
  const updatedArmor: ArmorEquipment = { ...next.armor, [itemSlot]: source.itemId };
  return { slots: next.slots, armor: updatedArmor };
}

function swapArmorWithSlot(
  state: PlayerInventoryState,
  req: { readonly armorSlot: ArmorSlotKey; readonly targetSlot: number; readonly equippedId: string },
  lookup: ArmorRuleLookup,
): PlayerInventoryState | null {
  const existing = state.slots[req.targetSlot];
  if (existing && lookup(existing.itemId)?.armorSlot !== req.armorSlot) return null;

  const next = cloneInventoryState(state);
  next.slots[req.targetSlot] = { itemId: req.equippedId, count: 1 };
  const updatedArmor: ArmorEquipment = { ...next.armor, [req.armorSlot]: existing ? existing.itemId : null };
  return { slots: next.slots, armor: updatedArmor };
}

/** Unequips `armorSlot` into a specified slot (swapping matching armor) or first open inventory slot. */
export function unequipArmorToSlot(
  state: PlayerInventoryState,
  req: { readonly armorSlot: ArmorSlotKey; readonly targetSlot?: number | undefined },
  deps: { readonly maxStackFor: StackLimitLookup; readonly lookup: ArmorRuleLookup },
): PlayerInventoryState | null {
  const equippedId = state.armor[req.armorSlot];
  if (!equippedId) return null;

  if (req.targetSlot !== undefined) {
    if (!isValidSlot(req.targetSlot, state.slots)) return null;
    return swapArmorWithSlot(state, { armorSlot: req.armorSlot, targetSlot: req.targetSlot, equippedId }, deps.lookup);
  }

  const next = cloneInventoryState(state);
  const inserted = insertIntoSlots(next.slots, { itemId: equippedId, count: 1 }, deps.maxStackFor);
  if (inserted !== 1) return null;
  const updatedArmor: ArmorEquipment = { ...next.armor, [req.armorSlot]: null };
  return { slots: next.slots, armor: updatedArmor };
}

/** Sums defense across all equipped armor slots. */
export function computeArmorDefense(armor: ArmorEquipment, lookup: ArmorRuleLookup): number {
  let total = 0;
  for (const key of ARMOR_SLOT_KEYS) {
    const itemId = armor[key];
    if (itemId) total += lookup(itemId)?.defense ?? 0;
  }
  return total;
}
