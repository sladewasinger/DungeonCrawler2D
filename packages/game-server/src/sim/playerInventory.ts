/** Authoritative player inventory, armor equip/unequip, and crafting state mutations. */
import { getItemDef, getRecipeDef, maxStackForItem, STARTER_LOADOUT } from "@dc2d/content";
import {
  PropKind,
  cloneInventoryState,
  craftRecipeInState,
  createEmptyInventoryState,
  equipArmorFromSlot,
  moveOrSwapSlot,
  unequipArmorToSlot,
  type ArmorSlotKey,
  type InventorySnapshot,
  type PlayerInventoryState,
  type WorldChunkCache,
} from "@dc2d/engine";

export const CAMPFIRE_CRAFT_RADIUS = 4.0;

export function createStarterInventory(): PlayerInventoryState {
  const state = createEmptyInventoryState();
  for (const entry of STARTER_LOADOUT) {
    if (entry.slot >= 0 && entry.slot < state.slots.length) {
      state.slots[entry.slot] = { itemId: entry.itemId, count: entry.count };
    }
  }
  return state;
}

export function isPlayerNearCampfire(cache: WorldChunkCache, x: number, y: number): boolean {
  const maxDistSq = CAMPFIRE_CRAFT_RADIUS * CAMPFIRE_CRAFT_RADIUS;
  for (const prop of cache.propsNear(x, y)) {
    if (prop.kind !== PropKind.Campfire) continue;
    const dx = prop.x - x;
    const dy = prop.y - y;
    if (dx * dx + dy * dy <= maxDistSq) return true;
  }
  return false;
}

export function movePlayerInventorySlot(
  state: PlayerInventoryState,
  move: { readonly from: number; readonly to: number },
): boolean {
  return moveOrSwapSlot(state.slots, move, maxStackForItem);
}

export function equipPlayerArmor(
  state: PlayerInventoryState,
  req: { readonly slotIndex: number; readonly targetArmor?: ArmorSlotKey | undefined },
): PlayerInventoryState | null {
  return equipArmorFromSlot(state, req, getItemDef);
}

export function unequipPlayerArmor(
  state: PlayerInventoryState,
  req: { readonly armorSlot: ArmorSlotKey; readonly targetSlot?: number | undefined },
): PlayerInventoryState | null {
  return unequipArmorToSlot(state, req, { maxStackFor: maxStackForItem, lookup: getItemDef });
}

export function craftPlayerRecipe(
  state: PlayerInventoryState,
  req: { readonly recipeId: string; readonly nearCampfire: boolean },
): PlayerInventoryState | null {
  const recipe = getRecipeDef(req.recipeId);
  if (!recipe) return null;
  return craftRecipeInState(state, { recipe, nearCampfire: req.nearCampfire, maxStackFor: maxStackForItem });
}

export function buildInventorySnapshot(input: {
  readonly state: PlayerInventoryState;
  readonly selectedHotbar: number;
  readonly nearCampfire: boolean;
}): InventorySnapshot {
  const cloned = cloneInventoryState(input.state);
  return {
    slots: cloned.slots,
    armor: cloned.armor,
    selectedHotbar: input.selectedHotbar,
    nearCampfire: input.nearCampfire,
  };
}
