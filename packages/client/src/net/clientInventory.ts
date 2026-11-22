/** Client-side inventory snapshot builders and local-preview fallback mutations. */
import { getItemDef, getRecipeDef, maxStackForItem, STARTER_LOADOUT } from "@dc2d/content";
import {
  HOTBAR_SLOT_COUNT,
  PropKind,
  cloneInventoryState,
  craftRecipeInState,
  createEmptyInventoryState,
  equipArmorFromSlot,
  moveOrSwapSlot,
  unequipArmorToSlot,
  type ArmorSlotKey,
  type InventorySnapshot,
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
  return { slots: state.slots, armor: state.armor, selectedHotbar: 0, nearCampfire: true };
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
