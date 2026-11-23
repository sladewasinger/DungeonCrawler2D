/** Client-side inventory snapshot builders and local-preview fallback mutations. */
import { getItemDef, getRecipeDef, maxStackForItem, STARTER_ARMOR, STARTER_LOADOUT } from "@dc2d/content";
import {
  HOTBAR_SLOT_COUNT,
  PropKind,
  cloneInventoryState,
  craftRecipeInState,
  createEmptyInventoryState,
  equipArmorFromSlot,
  moveOrSwapSlot,
  quickTransferChestSlot,
  takeAllFromChest,
  transferChestSlot,
  unequipArmorToSlot,
  type ArmorSlotKey,
  type InventorySnapshot,
  type WorldChestSnapshot,
  type WorldChunkCache,
} from "@dc2d/engine";

const CAMPFIRE_RADIUS_SQ = 4.0 * 4.0;

export function createStarterInventorySnapshot(): InventorySnapshot {
  const state = createEmptyInventoryState();
  for (const entry of STARTER_LOADOUT) {
    if (entry.slot >= 0 && entry.slot < state.slots.length) {
      state.slots[entry.slot] = { itemId: entry.itemId, count: entry.count };
    }
  }
  return { slots: state.slots, armor: { ...STARTER_ARMOR }, selectedHotbar: 0, nearCampfire: true };
}

export function isNearCampfire(cache: WorldChunkCache, x: number, y: number): boolean {
  for (const prop of cache.propsNear(x, y)) {
    if (prop.kind !== PropKind.Campfire) continue;
    const dx = prop.x - x;
    const dy = prop.y - y;
    if (dx * dx + dy * dy <= CAMPFIRE_RADIUS_SQ) return true;
  }
  return false;
}

export function applyMoveSlot(inv: InventorySnapshot, move: { readonly from: number; readonly to: number }): InventorySnapshot {
  const cloned = cloneInventoryState(inv);
  if (!moveOrSwapSlot(cloned.slots, move, maxStackForItem)) return inv;
  return { ...inv, slots: cloned.slots, armor: cloned.armor };
}

export function applyEquipArmor(
  inv: InventorySnapshot,
  req: { readonly slotIndex: number; readonly targetArmor?: ArmorSlotKey | undefined },
): InventorySnapshot {
  const next = equipArmorFromSlot(inv, req, getItemDef);
  return next ? { ...inv, slots: next.slots, armor: next.armor } : inv;
}

export function applyUnequipArmor(
  inv: InventorySnapshot,
  req: { readonly armorSlot: ArmorSlotKey; readonly targetSlot?: number | undefined },
): InventorySnapshot {
  const next = unequipArmorToSlot(inv, req, { maxStackFor: maxStackForItem, lookup: getItemDef });
  return next ? { ...inv, slots: next.slots, armor: next.armor } : inv;
}

export function applyCraftRecipe(inv: InventorySnapshot, recipeId: string): InventorySnapshot {
  const recipe = getRecipeDef(recipeId);
  if (!recipe) return inv;
  const next = craftRecipeInState(inv, { recipe, nearCampfire: inv.nearCampfire, maxStackFor: maxStackForItem });
  return next ? { ...inv, slots: next.slots, armor: next.armor } : inv;
}

export function applySelectHotbar(inv: InventorySnapshot, slot: number): InventorySnapshot {
  if (slot < 0 || slot >= HOTBAR_SLOT_COUNT) return inv;
  return { ...inv, selectedHotbar: slot };
}

export function heldItemForInventory(inv: InventorySnapshot): string | null {
  return inv.slots[inv.selectedHotbar]?.itemId ?? null;
}

export function findNearestChest(
  chests: readonly WorldChestSnapshot[],
  pos: { readonly x: number; readonly y: number },
  radius: number,
): WorldChestSnapshot | undefined {
  let best: WorldChestSnapshot | undefined;
  let bestDist = radius;
  for (const c of chests) {
    const d = Math.hypot(c.x - pos.x, c.y - pos.y);
    if (d <= bestDist) { bestDist = d; best = c; }
  }
  return best;
}

export function applyChestTransfer(opts: {
  readonly inv: InventorySnapshot; readonly chest: WorldChestSnapshot;
  readonly from: "chest" | "inv"; readonly fromSlot: number;
  readonly to: "chest" | "inv"; readonly toSlot: number; readonly quick?: boolean | undefined;
}): { readonly inv: InventorySnapshot; readonly chest: WorldChestSnapshot } {
  const nextSlots = opts.inv.slots.map((s) => (s ? { ...s } : null));
  const nextChestSlots = opts.chest.slots.map((s) => (s ? { ...s } : null));
  const changed = opts.quick
    ? quickTransferChestSlot({ chestSlots: nextChestSlots, invSlots: nextSlots, from: opts.from, slotIndex: opts.fromSlot, maxStackFor: maxStackForItem })
    : transferChestSlot({ chestSlots: nextChestSlots, invSlots: nextSlots, from: opts.from, fromSlot: opts.fromSlot, to: opts.to, toSlot: opts.toSlot, maxStackFor: maxStackForItem });
  if (!changed) return { inv: opts.inv, chest: opts.chest };
  return { inv: { ...opts.inv, slots: nextSlots }, chest: { ...opts.chest, opened: true, slots: nextChestSlots } };
}

export function applyChestTakeAll(opts: {
  readonly inv: InventorySnapshot; readonly chest: WorldChestSnapshot;
}): { readonly inv: InventorySnapshot; readonly chest: WorldChestSnapshot } {
  const nextSlots = opts.inv.slots.map((s) => (s ? { ...s } : null));
  const nextChestSlots = opts.chest.slots.map((s) => (s ? { ...s } : null));
  takeAllFromChest({ chestSlots: nextChestSlots, invSlots: nextSlots, maxStackFor: maxStackForItem });
  return { inv: { ...opts.inv, slots: nextSlots }, chest: { ...opts.chest, opened: true, slots: nextChestSlots } };
}

export function reconcileInventorySnapshot(input: {
  readonly current: InventorySnapshot;
  readonly incoming: InventorySnapshot;
  readonly pendingSeq: number;
  readonly elapsedMs: number;
  readonly timeoutMs?: number;
}): { readonly inventory: InventorySnapshot; readonly clearedPending: boolean } {
  if (input.pendingSeq <= 0) return { inventory: input.incoming, clearedPending: false };
  const timeoutMs = input.timeoutMs ?? 1500;
  const ack = input.incoming.ackSeq ?? 0;
  if (ack >= input.pendingSeq || input.elapsedMs >= timeoutMs) {
    return { inventory: input.incoming, clearedPending: true };
  }
  return {
    inventory: { ...input.current, nearCampfire: input.incoming.nearCampfire },
    clearedPending: false,
  };
}
