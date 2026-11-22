/** Authoritative item definitions with explicit stack-limit and armor stats. */

export type ItemCategory = "weapon" | "tool" | "armor" | "consumable" | "material";
export type ArmorSlot = "head" | "chest" | "legs" | "feet";

export interface ItemDef {
  readonly id: string;
  readonly name: string;
  readonly category: ItemCategory;
  readonly maxStack: number;
  readonly armorSlot?: ArmorSlot;
  readonly defense?: number;
}

export interface StarterLoadoutEntry {
  readonly slot: number;
  readonly itemId: string;
  readonly count: number;
}

const CAT_WEAPON: ItemCategory = "weapon";
const CAT_TOOL: ItemCategory = "tool";
const CAT_ARMOR: ItemCategory = "armor";
const CAT_CONSUMABLE: ItemCategory = "consumable";
const CAT_MATERIAL: ItemCategory = "material";

export const ITEM_CATALOG: readonly ItemDef[] = [
  { id: "sword", name: "Iron Sword", category: CAT_WEAPON, maxStack: 1 },
  { id: "bow", name: "Hunter Bow", category: CAT_WEAPON, maxStack: 1 },
  { id: "axe", name: "Woodcutter Axe", category: CAT_TOOL, maxStack: 1 },
  { id: "pickaxe", name: "Stone Pickaxe", category: CAT_TOOL, maxStack: 1 },
  { id: "leather-hood", name: "Leather Hood", category: CAT_ARMOR, maxStack: 1, armorSlot: "head", defense: 2 },
  { id: "leather-tunic", name: "Leather Tunic", category: CAT_ARMOR, maxStack: 1, armorSlot: "chest", defense: 4 },
  { id: "leather-leggings", name: "Leather Leggings", category: CAT_ARMOR, maxStack: 1, armorSlot: "legs", defense: 3 },
  { id: "leather-boots", name: "Leather Boots", category: CAT_ARMOR, maxStack: 1, armorSlot: "feet", defense: 2 },
  { id: "torch", name: "Torch", category: CAT_CONSUMABLE, maxStack: 32 },
  { id: "bandage", name: "Bandage", category: CAT_CONSUMABLE, maxStack: 16 },
  { id: "cooked-meat", name: "Cooked Meat", category: CAT_CONSUMABLE, maxStack: 16 },
  { id: "raw-meat", name: "Raw Meat", category: CAT_MATERIAL, maxStack: 16 },
  { id: "arrow", name: "Arrow", category: CAT_MATERIAL, maxStack: 64 },
  { id: "wood", name: "Wood", category: CAT_MATERIAL, maxStack: 64 },
  { id: "stone", name: "Stone", category: CAT_MATERIAL, maxStack: 64 },
  { id: "flint", name: "Flint", category: CAT_MATERIAL, maxStack: 32 },
  { id: "herb", name: "Forest Herb", category: CAT_MATERIAL, maxStack: 32 },
];

export const STARTER_LOADOUT: readonly StarterLoadoutEntry[] = [
  { slot: 0, itemId: "sword", count: 1 },
  { slot: 1, itemId: "bow", count: 1 },
  { slot: 2, itemId: "arrow", count: 16 },
  { slot: 3, itemId: "torch", count: 4 },
  { slot: 4, itemId: "bandage", count: 3 },
  { slot: 9, itemId: "leather-hood", count: 1 },
  { slot: 10, itemId: "leather-tunic", count: 1 },
  { slot: 11, itemId: "wood", count: 8 },
  { slot: 12, itemId: "stone", count: 6 },
  { slot: 13, itemId: "flint", count: 4 },
  { slot: 14, itemId: "raw-meat", count: 3 },
  { slot: 15, itemId: "herb", count: 4 },
];

const ITEM_MAP = new Map<string, ItemDef>(ITEM_CATALOG.map((item) => [item.id, item]));

export function getItemDef(itemId: string): ItemDef | undefined {
  return ITEM_MAP.get(itemId);
}

export function maxStackForItem(itemId: string): number {
  return ITEM_MAP.get(itemId)?.maxStack ?? 64;
}
