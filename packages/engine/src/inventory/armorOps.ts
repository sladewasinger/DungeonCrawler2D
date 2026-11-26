/** Pure armor equipment swap, unequip, prefix tracking, and defense helpers for 36-slot inventory. */
import { ARMOR_SLOT_KEYS } from "@dc2d/contracts";
import {
  insertIntoSlots,
  makeSlotItem,
  type ArmorEquipment,
  type ArmorPrefixMap,
  type ArmorSlotKey,
  type InventorySlot,
  type PlayerInventoryState,
  type StackLimitLookup,
} from "./slotModel.js";

export { ARMOR_SLOT_KEYS };

export interface ArmorItemRule {
  readonly armorSlot?: ArmorSlotKey | undefined;
  readonly defense?: number | undefined;
}

export type ArmorRuleLookup = (itemId: string, prefixId?: string | null) => ArmorItemRule | undefined;

function cleanPrefixMap(prefixes: ArmorPrefixMap | undefined): ArmorPrefixMap | undefined {
  if (!prefixes) return undefined;
  const out: ArmorPrefixMap = {};
  let hasAny = false;
  for (const key of ARMOR_SLOT_KEYS) {
    const p = prefixes[key];
    if (p) { out[key] = p; hasAny = true; }
  }
  return hasAny ? out : undefined;
}

function withUpdatedArmorPrefix(
  prefixes: ArmorPrefixMap | undefined,
  slot: ArmorSlotKey,
  nextPrefix: string | undefined,
): ArmorPrefixMap | undefined {
  const copy: ArmorPrefixMap = { ...(prefixes ?? {}) };
  if (nextPrefix) copy[slot] = nextPrefix;
  else delete copy[slot];
  return cleanPrefixMap(copy);
}

export function cloneInventoryState(state: PlayerInventoryState): PlayerInventoryState {
  const prefixes = cleanPrefixMap(state.armorPrefixes);
  return {
    slots: state.slots.map((slot) => (slot ? makeSlotItem(slot.itemId, slot.count, slot.prefixId) : null)),
    armor: { ...state.armor },
    ...(prefixes ? { armorPrefixes: prefixes } : {}),
  };
}

function isValidSlot(index: number, slots: readonly InventorySlot[]): boolean {
  return Number.isInteger(index) && index >= 0 && index < slots.length;
}

function resolveValidEquipSource(
  state: PlayerInventoryState,
  req: { readonly slotIndex: number; readonly targetArmor?: ArmorSlotKey | undefined },
  lookup: ArmorRuleLookup,
): { readonly source: NonNullable<InventorySlot>; readonly itemSlot: ArmorSlotKey } | null {
  if (!isValidSlot(req.slotIndex, state.slots)) return null;
  const source = state.slots[req.slotIndex];
  const itemSlot = source ? lookup(source.itemId, source.prefixId)?.armorSlot : undefined;
  if (!source || !itemSlot || (req.targetArmor && req.targetArmor !== itemSlot)) return null;
  return { source, itemSlot };
}

/** Equips an armor item from `slotIndex` into its matching armor slot, swapping any previous piece back. */
export function equipArmorFromSlot(
  state: PlayerInventoryState,
  req: { readonly slotIndex: number; readonly targetArmor?: ArmorSlotKey | undefined },
  lookup: ArmorRuleLookup,
): PlayerInventoryState | null {
  const valid = resolveValidEquipSource(state, req, lookup);
  if (!valid) return null;
  const { source, itemSlot } = valid;
  const next = cloneInventoryState(state);
  const previousId = next.armor[itemSlot];
  const previousPrefix = next.armorPrefixes?.[itemSlot];
  next.slots[req.slotIndex] = previousId ? makeSlotItem(previousId, 1, previousPrefix) : null;
  const updatedArmor: ArmorEquipment = { ...next.armor, [itemSlot]: source.itemId };
  const updatedPrefixes = withUpdatedArmorPrefix(next.armorPrefixes, itemSlot, source.prefixId);
  return { slots: next.slots, armor: updatedArmor, ...(updatedPrefixes ? { armorPrefixes: updatedPrefixes } : {}) };
}

function swapArmorWithSlot(
  state: PlayerInventoryState,
  req: { readonly armorSlot: ArmorSlotKey; readonly targetSlot: number; readonly equippedId: string },
  lookup: ArmorRuleLookup,
): PlayerInventoryState | null {
  const existing = state.slots[req.targetSlot];
  if (existing && lookup(existing.itemId, existing.prefixId)?.armorSlot !== req.armorSlot) return null;

  const next = cloneInventoryState(state);
  const prevPrefix = next.armorPrefixes?.[req.armorSlot];
  next.slots[req.targetSlot] = makeSlotItem(req.equippedId, 1, prevPrefix);
  const updatedArmor: ArmorEquipment = { ...next.armor, [req.armorSlot]: existing ? existing.itemId : null };
  const updatedPrefixes = withUpdatedArmorPrefix(next.armorPrefixes, req.armorSlot, existing?.prefixId);
  return { slots: next.slots, armor: updatedArmor, ...(updatedPrefixes ? { armorPrefixes: updatedPrefixes } : {}) };
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
  const prevPrefix = next.armorPrefixes?.[req.armorSlot];
  const inserted = insertIntoSlots(next.slots, makeSlotItem(equippedId, 1, prevPrefix), deps.maxStackFor);
  if (inserted !== 1) return null;
  const updatedArmor: ArmorEquipment = { ...next.armor, [req.armorSlot]: null };
  const updatedPrefixes = withUpdatedArmorPrefix(next.armorPrefixes, req.armorSlot, undefined);
  return { slots: next.slots, armor: updatedArmor, ...(updatedPrefixes ? { armorPrefixes: updatedPrefixes } : {}) };
}

/** Sums defense across all equipped armor slots. */
export function computeArmorDefense(
  armor: ArmorEquipment,
  lookup: ArmorRuleLookup,
  armorPrefixes?: ArmorPrefixMap | undefined,
): number {
  let total = 0;
  for (const key of ARMOR_SLOT_KEYS) {
    const itemId = armor[key];
    if (itemId) total += lookup(itemId, armorPrefixes?.[key])?.defense ?? 0;
  }
  return total;
}
