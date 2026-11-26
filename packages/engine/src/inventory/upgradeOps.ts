/** Pure Blacksmith prefix reforging & +1..+3 gear upgrade state transitions [REQ-P9-10][REQ-P9-11]. */
import {
  computeReforgeCost,
  computeUpgradeCost,
  eligiblePrefixesForItem,
  getItemDef,
  isItemReforgeableOrUpgradeable,
} from "@dc2d/content";
import { consumeItemFromSlots, makeSlotItem, type InventorySlot, type SlotItem } from "./slotModel.js";

export const MAX_GEAR_UPGRADE_LEVEL = 3;

export interface BlacksmithOpResult {
  readonly ok: boolean;
  readonly gold: number;
  readonly slots: InventorySlot[];
  readonly updatedItem?: SlotItem | undefined;
  readonly error?: string | undefined;
}

function countItem(slots: readonly InventorySlot[], itemId: string): number {
  let total = 0;
  for (const s of slots) {
    if (s && s.itemId === itemId) total += s.count;
  }
  return total;
}

function cloneSlots(slots: readonly InventorySlot[]): InventorySlot[] {
  return slots.map((s) => (s ? makeSlotItem(s.itemId, s.count, { prefixId: s.prefixId, upgradeLevel: s.upgradeLevel }) : null));
}

function failOp(gold: number, slots: readonly InventorySlot[], error: string): BlacksmithOpResult {
  return { ok: false, gold, slots: cloneSlots(slots), error };
}

function pickDistinctPrefix(itemId: string, currentPrefix: string | undefined, unitRoll: number): string | null {
  const def = getItemDef(itemId);
  if (!def) return null;
  const candidates = eligiblePrefixesForItem(def).filter((p) => p.id !== currentPrefix);
  if (candidates.length === 0) return null;
  const clamped = Math.max(0, Math.min(0.999999, unitRoll));
  return candidates[Math.floor(clamped * candidates.length)]?.id ?? candidates[0]?.id ?? null;
}

export function applyBlacksmithReforge(opts: {
  readonly slots: readonly InventorySlot[];
  readonly gold: number;
  readonly slotIndex: number;
  readonly unitRoll: number;
}): BlacksmithOpResult {
  const target = opts.slots[opts.slotIndex];
  if (!target) return failOp(opts.gold, opts.slots, "Select gear to reforge");
  if (!isItemReforgeableOrUpgradeable(target.itemId)) return failOp(opts.gold, opts.slots, "Item cannot be reforged");
  const cost = computeReforgeCost({ itemId: target.itemId, prefixId: target.prefixId });
  if (opts.gold < cost.gold) return failOp(opts.gold, opts.slots, "Not enough Gold");
  if (countItem(opts.slots, cost.material.itemId) < cost.material.count) {
    return failOp(opts.gold, opts.slots, `Need ${cost.material.count} ${cost.material.itemId}`);
  }
  const nextPrefix = pickDistinctPrefix(target.itemId, target.prefixId, opts.unitRoll);
  if (!nextPrefix) return failOp(opts.gold, opts.slots, "No eligible prefix available");
  const nextSlots = cloneSlots(opts.slots);
  if (!consumeItemFromSlots(nextSlots, cost.material.itemId, cost.material.count)) {
    return failOp(opts.gold, opts.slots, "Missing material");
  }
  const updated = makeSlotItem(target.itemId, target.count, { prefixId: nextPrefix, upgradeLevel: target.upgradeLevel });
  nextSlots[opts.slotIndex] = updated;
  return { ok: true, gold: opts.gold - cost.gold, slots: nextSlots, updatedItem: updated };
}

export function applyBlacksmithUpgrade(opts: {
  readonly slots: readonly InventorySlot[];
  readonly gold: number;
  readonly slotIndex: number;
}): BlacksmithOpResult {
  const target = opts.slots[opts.slotIndex];
  if (!target) return failOp(opts.gold, opts.slots, "Select gear to upgrade");
  if (!isItemReforgeableOrUpgradeable(target.itemId)) return failOp(opts.gold, opts.slots, "Item cannot be upgraded");
  const cost = computeUpgradeCost(target.upgradeLevel ?? 0);
  if (!cost) return failOp(opts.gold, opts.slots, "Maximum upgrade level (+3) reached");
  if (opts.gold < cost.gold) return failOp(opts.gold, opts.slots, "Not enough Gold");
  if (countItem(opts.slots, cost.material.itemId) < cost.material.count) {
    return failOp(opts.gold, opts.slots, `Need ${cost.material.count} ${cost.material.itemId}`);
  }
  const nextSlots = cloneSlots(opts.slots);
  if (!consumeItemFromSlots(nextSlots, cost.material.itemId, cost.material.count)) {
    return failOp(opts.gold, opts.slots, "Missing material");
  }
  const updated = makeSlotItem(target.itemId, target.count, { prefixId: target.prefixId, upgradeLevel: cost.nextLevel });
  nextSlots[opts.slotIndex] = updated;
  return { ok: true, gold: opts.gold - cost.gold, slots: nextSlots, updatedItem: updated };
}
