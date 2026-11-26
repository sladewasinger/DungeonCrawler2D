/** Pure armor equipment swap, unequip, prefix tracking, and defense helpers for 36-slot inventory. */
import { ARMOR_SLOT_KEYS } from "@dc2d/contracts";
import {
  insertIntoSlots,
  makeSlotItem,
  type ArmorEquipment,
  type ArmorPrefixMap,
  type ArmorSlotKey,
  type ArmorUpgradeMap,
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

function cleanUpgradeMap(upgrades: ArmorUpgradeMap | undefined): ArmorUpgradeMap | undefined {
  if (!upgrades) return undefined;
  const out: ArmorUpgradeMap = {};
  let hasAny = false;
  for (const key of ARMOR_SLOT_KEYS) {
    const lv = upgrades[key];
    if (lv && lv > 0) { out[key] = lv; hasAny = true; }
  }
  return hasAny ? out : undefined;
}

function withUpdatedArmorUpgrade(
  upgrades: ArmorUpgradeMap | undefined,
  slot: ArmorSlotKey,
  nextUpgrade: number | undefined,
): ArmorUpgradeMap | undefined {
  const copy: ArmorUpgradeMap = { ...(upgrades ?? {}) };
  if (nextUpgrade && nextUpgrade > 0) copy[slot] = nextUpgrade;
  else delete copy[slot];
  return cleanUpgradeMap(copy);
}

export function cloneInventoryState(state: PlayerInventoryState): PlayerInventoryState {
  const prefixes = cleanPrefixMap(state.armorPrefixes);
  const upgrades = cleanUpgradeMap(state.armorUpgrades);
  return {
    slots: state.slots.map((slot) => (slot ? makeSlotItem(slot.itemId, slot.count, { prefixId: slot.prefixId, upgradeLevel: slot.upgradeLevel }) : null)),
    armor: { ...state.armor },
    ...(prefixes ? { armorPrefixes: prefixes } : {}),
    ...(upgrades ? { armorUpgrades: upgrades } : {}),
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
  const previousUpgrade = next.armorUpgrades?.[itemSlot];
  next.slots[req.slotIndex] = previousId ? makeSlotItem(previousId, 1, { prefixId: previousPrefix, upgradeLevel: previousUpgrade }) : null;
  const updatedArmor: ArmorEquipment = { ...next.armor, [itemSlot]: source.itemId };
  const updatedPrefixes = withUpdatedArmorPrefix(next.armorPrefixes, itemSlot, source.prefixId);
  const updatedUpgrades = withUpdatedArmorUpgrade(next.armorUpgrades, itemSlot, source.upgradeLevel);
  return {
    slots: next.slots,
    armor: updatedArmor,
    ...(updatedPrefixes ? { armorPrefixes: updatedPrefixes } : {}),
    ...(updatedUpgrades ? { armorUpgrades: updatedUpgrades } : {}),
  };
}

function buildArmorUpdateResult(opts: {
  readonly slots: InventorySlot[];
  readonly armor: ArmorEquipment;
  readonly armorPrefixes: ArmorPrefixMap | undefined;
  readonly armorUpgrades: ArmorUpgradeMap | undefined;
}): PlayerInventoryState {
  return {
    slots: opts.slots,
    armor: opts.armor,
    ...(opts.armorPrefixes ? { armorPrefixes: opts.armorPrefixes } : {}),
    ...(opts.armorUpgrades ? { armorUpgrades: opts.armorUpgrades } : {}),
  };
}

function applyArmorSwapState(opts: {
  readonly state: PlayerInventoryState;
  readonly armorSlot: ArmorSlotKey;
  readonly targetSlot: number;
  readonly equippedId: string;
}): PlayerInventoryState {
  const existing = opts.state.slots[opts.targetSlot] ?? null;
  const next = cloneInventoryState(opts.state);
  const prevPrefix = next.armorPrefixes?.[opts.armorSlot];
  const prevUpgrade = next.armorUpgrades?.[opts.armorSlot];
  next.slots[opts.targetSlot] = makeSlotItem(opts.equippedId, 1, { prefixId: prevPrefix, upgradeLevel: prevUpgrade });
  return buildArmorUpdateResult({
    slots: next.slots,
    armor: { ...next.armor, [opts.armorSlot]: existing?.itemId ?? null },
    armorPrefixes: withUpdatedArmorPrefix(next.armorPrefixes, opts.armorSlot, existing?.prefixId),
    armorUpgrades: withUpdatedArmorUpgrade(next.armorUpgrades, opts.armorSlot, existing?.upgradeLevel),
  });
}

function swapArmorWithSlot(
  state: PlayerInventoryState,
  req: { readonly armorSlot: ArmorSlotKey; readonly targetSlot: number; readonly equippedId: string },
  lookup: ArmorRuleLookup,
): PlayerInventoryState | null {
  const existing = state.slots[req.targetSlot];
  if (existing && lookup(existing.itemId, existing.prefixId)?.armorSlot !== req.armorSlot) return null;
  return applyArmorSwapState({ state, armorSlot: req.armorSlot, targetSlot: req.targetSlot, equippedId: req.equippedId });
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
  const item = makeSlotItem(equippedId, 1, { prefixId: next.armorPrefixes?.[req.armorSlot], upgradeLevel: next.armorUpgrades?.[req.armorSlot] });
  if (insertIntoSlots(next.slots, item, deps.maxStackFor) !== 1) return null;
  return buildArmorUpdateResult({
    slots: next.slots,
    armor: { ...next.armor, [req.armorSlot]: null },
    armorPrefixes: withUpdatedArmorPrefix(next.armorPrefixes, req.armorSlot, undefined),
    armorUpgrades: withUpdatedArmorUpgrade(next.armorUpgrades, req.armorSlot, undefined),
  });
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
