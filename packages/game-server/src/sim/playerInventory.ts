/** Authoritative player inventory, armor equip/unequip, and crafting state mutations. */
import { getItemDef, getRecipeDef, maxStackForItem, STARTER_ARMOR, STARTER_LOADOUT } from "@dc2d/content";
import {
  PropKind,
  cloneInventoryState,
  craftRecipeInState,
  createEmptyInventoryState,
  equipArmorFromSlot,
  moveOrSwapSlot,
  removeFromSlot,
  unequipArmorToSlot,
  type ArmorSlotKey,
  type DropItemRequest,
  type InventorySnapshot,
  type PlayerInventoryState,
  type SlotItem,
  type WorldChunkCache,
} from "@dc2d/engine";

export const CAMPFIRE_CRAFT_RADIUS = 4.0;

export function applyLoadoutEntries(
  state: PlayerInventoryState,
  entries: readonly { readonly slot: number; readonly itemId: string; readonly count: number }[],
): void {
  for (const entry of entries) {
    if (entry.slot >= 0 && entry.slot < state.slots.length) {
      state.slots[entry.slot] = entry.count > 0 ? { itemId: entry.itemId, count: entry.count } : null;
    }
  }
}

export function createStarterInventory(): PlayerInventoryState {
  const state: PlayerInventoryState = { ...createEmptyInventoryState(), armor: { ...STARTER_ARMOR } };
  applyLoadoutEntries(state, STARTER_LOADOUT);
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

function takeDroppedInvItem(
  state: PlayerInventoryState,
  slotIndex: number,
  count?: number,
): { readonly nextState: PlayerInventoryState; readonly item: SlotItem } | null {
  const nextSlots = state.slots.map((s) => (s ? { ...s } : null));
  const item = removeFromSlot(nextSlots, slotIndex, count);
  if (!item) return null;
  return {
    nextState: { slots: nextSlots, armor: state.armor, ...(state.armorPrefixes ? { armorPrefixes: state.armorPrefixes } : {}) },
    item,
  };
}

function takeDroppedArmorItem(
  state: PlayerInventoryState,
  armorSlot: ArmorSlotKey,
): { readonly nextState: PlayerInventoryState; readonly item: SlotItem } | null {
  const cur = state.armor[armorSlot];
  if (!cur) return null;
  const prefixId = state.armorPrefixes?.[armorSlot];
  const armor = { ...state.armor, [armorSlot]: null };
  const nextPrefixes = state.armorPrefixes ? { ...state.armorPrefixes } : undefined;
  if (nextPrefixes) delete nextPrefixes[armorSlot];
  const hasPrefixes = nextPrefixes && Object.keys(nextPrefixes).length > 0;
  return {
    nextState: { slots: state.slots, armor, ...(hasPrefixes ? { armorPrefixes: nextPrefixes } : {}) },
    item: prefixId ? { itemId: cur, count: 1, prefixId } : { itemId: cur, count: 1 },
  };
}

export function takeDroppedPlayerItem(
  state: PlayerInventoryState,
  req: DropItemRequest,
): { readonly nextState: PlayerInventoryState; readonly item: SlotItem } | null {
  if (req.source === "inv" && req.slotIndex !== undefined) {
    return takeDroppedInvItem(state, req.slotIndex, req.count);
  }
  return req.source === "armor" && req.armorSlot ? takeDroppedArmorItem(state, req.armorSlot) : null;
}

export function buildInventorySnapshot(input: {
  readonly state: PlayerInventoryState;
  readonly selectedHotbar: number;
  readonly nearCampfire: boolean;
  readonly ackSeq?: number | undefined;
}): InventorySnapshot {
  const cloned = cloneInventoryState(input.state);
  return {
    slots: cloned.slots,
    armor: cloned.armor,
    ...(cloned.armorPrefixes ? { armorPrefixes: cloned.armorPrefixes } : {}),
    selectedHotbar: input.selectedHotbar,
    nearCampfire: input.nearCampfire,
    ...(input.ackSeq !== undefined ? { ackSeq: input.ackSeq } : {}),
  };
}
