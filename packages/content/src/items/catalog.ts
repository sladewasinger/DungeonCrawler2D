/** Authoritative item definitions with explicit stack-limit and armor stats. */

export type ItemCategory = "weapon" | "tool" | "armor" | "consumable" | "material";
export type ItemWeaponArchetype = "sword" | "axe" | "pickaxe" | "torch" | "spear" | "dagger" | "greatsword";
export type PlaceableStructureKind = "campfire" | "torch" | "wood-chest" | "workbench" | "bed" | "palisade";
export type ArmorSlot = "head" | "chest" | "legs" | "feet" | "offhand";
export type GoreStyle = "splatter" | "thin-streak" | "drip" | "chunk-spray" | "explode-away";
export type CosmeticLayerSlot =
  | "head"
  | "face"
  | "chest"
  | "sleeves"
  | "gloves"
  | "legs"
  | "feet"
  | "cape"
  | "offhand";

export interface ItemVisualLayerSpec {
  readonly slot: CosmeticLayerSlot;
  readonly assetId: string;
  readonly sleeveAssetId?: string;
  readonly gendered?: boolean;
  readonly zOrder: number;
  readonly hidesHair?: boolean;
  readonly recolorPrimary?: string;
  readonly recolorTrim?: string;
}

export interface ItemDef {
  readonly id: string;
  readonly name: string;
  readonly category: ItemCategory;
  readonly maxStack: number;
  readonly armorSlot?: ArmorSlot;
  readonly defense?: number;
  readonly blockMitigation?: number;
  readonly damage?: number;
  readonly staminaCost?: number;
  readonly range?: number;
  readonly arcRad?: number;
  readonly weaponArchetype?: ItemWeaponArchetype;
  readonly placeStructure?: PlaceableStructureKind;
  readonly healHp?: number;
  readonly wellFedSec?: number;
  readonly goreStyle?: GoreStyle;
  readonly visualLayer?: ItemVisualLayerSpec;
}

export interface StarterLoadoutEntry {
  readonly slot: number;
  readonly itemId: string;
  readonly count: number;
}

export interface StarterArmorLoadout {
  readonly head: string | null;
  readonly chest: string | null;
  readonly legs: string | null;
  readonly feet: string | null;
  readonly offhand: string | null;
}

export const STARTER_ARMOR: StarterArmorLoadout = {
  head: null,
  chest: "leather-tunic",
  legs: "leather-leggings",
  feet: "leather-boots",
  offhand: null,
};

const CAT_WEAPON: ItemCategory = "weapon";
const CAT_TOOL: ItemCategory = "tool";
const CAT_ARMOR: ItemCategory = "armor";
const CAT_CONSUMABLE: ItemCategory = "consumable";
const CAT_MATERIAL: ItemCategory = "material";

export const ITEM_CATALOG: readonly ItemDef[] = [
  { id: "sword", name: "Iron Sword", category: CAT_WEAPON, maxStack: 1, weaponArchetype: "sword", damage: 18, staminaCost: 12, range: 1.85, arcRad: 1.75, goreStyle: "thin-streak" },
  { id: "bow", name: "Hunter Bow", category: CAT_WEAPON, maxStack: 1, damage: 22, staminaCost: 14, range: 11, goreStyle: "drip" },
  { id: "axe", name: "Woodcutter Axe", category: CAT_TOOL, maxStack: 1, weaponArchetype: "axe", damage: 20, staminaCost: 16, range: 1.75, arcRad: 1.6, goreStyle: "chunk-spray" },
  { id: "pickaxe", name: "Stone Pickaxe", category: CAT_TOOL, maxStack: 1, weaponArchetype: "pickaxe", damage: 14, staminaCost: 14, range: 1.65, arcRad: 1.4, goreStyle: "chunk-spray" },
  { id: "map", name: "Overworld Map", category: CAT_TOOL, maxStack: 1 },
  { id: "wooden-shield", name: "Wooden Shield", category: CAT_ARMOR, maxStack: 1, armorSlot: "offhand", defense: 2, blockMitigation: 0.75 },
  {
    id: "leather-hood", name: "Leather Hood", category: CAT_ARMOR, maxStack: 1, armorSlot: "head", defense: 2,
    visualLayer: { slot: "head", assetId: "armor-head-leather-hood", gendered: false, zOrder: 50, hidesHair: true },
  },
  {
    id: "leather-tunic", name: "Leather Tunic", category: CAT_ARMOR, maxStack: 1, armorSlot: "chest", defense: 4,
    visualLayer: {
      slot: "chest", assetId: "armor-chest-leather-tunic", sleeveAssetId: "armor-chest-sleeves",
      gendered: true, zOrder: 30,
    },
  },
  {
    id: "leather-leggings", name: "Leather Leggings", category: CAT_ARMOR, maxStack: 1, armorSlot: "legs", defense: 3,
    visualLayer: { slot: "legs", assetId: "armor-legs-leather-leggings", gendered: true, zOrder: 20 },
  },
  {
    id: "leather-boots", name: "Leather Boots", category: CAT_ARMOR, maxStack: 1, armorSlot: "feet", defense: 2,
    visualLayer: { slot: "feet", assetId: "armor-feet-leather-boots", gendered: false, zOrder: 10 },
  },
  { id: "torch", name: "Torch", category: CAT_CONSUMABLE, maxStack: 32, weaponArchetype: "torch", damage: 10, staminaCost: 10, range: 1.65, arcRad: 1.5, goreStyle: "splatter" },
  { id: "bandage", name: "Bandage", category: CAT_CONSUMABLE, maxStack: 16, healHp: 25 },
  { id: "cooked-meat", name: "Cooked Meat", category: CAT_CONSUMABLE, maxStack: 16, healHp: 40, wellFedSec: 180 },
  { id: "berry", name: "Wild Berries", category: CAT_CONSUMABLE, maxStack: 24, healHp: 12, wellFedSec: 45 },
  { id: "herb-tea", name: "Herbal Tea", category: CAT_CONSUMABLE, maxStack: 16, healHp: 22, wellFedSec: 150 },
  { id: "healing-salve", name: "Herbal Salve", category: CAT_CONSUMABLE, maxStack: 12, healHp: 50 },
  { id: "camp-campfire", name: "Campfire Kit", category: CAT_TOOL, maxStack: 8, placeStructure: "campfire" },
  { id: "standing-torch", name: "Standing Torch", category: CAT_TOOL, maxStack: 16, placeStructure: "torch" },
  { id: "storage-chest", name: "Storage Chest", category: CAT_TOOL, maxStack: 8, placeStructure: "wood-chest" },
  { id: "workbench", name: "Workbench", category: CAT_TOOL, maxStack: 4, placeStructure: "workbench" },
  { id: "camp-bed", name: "Camp Bed", category: CAT_TOOL, maxStack: 4, placeStructure: "bed" },
  { id: "wood-palisade", name: "Wooden Palisade", category: CAT_TOOL, maxStack: 24, placeStructure: "palisade" },
  { id: "raw-meat", name: "Raw Meat", category: CAT_MATERIAL, maxStack: 16 },
  { id: "arrow", name: "Arrow", category: CAT_MATERIAL, maxStack: 64 },
  { id: "wood", name: "Wood", category: CAT_MATERIAL, maxStack: 64 },
  { id: "stone", name: "Stone", category: CAT_MATERIAL, maxStack: 64 },
  { id: "flint", name: "Flint", category: CAT_MATERIAL, maxStack: 32 },
  { id: "copper-ore", name: "Copper Ore", category: CAT_MATERIAL, maxStack: 32 },
  { id: "iron-ore", name: "Iron Ore", category: CAT_MATERIAL, maxStack: 32 },
  { id: "herb", name: "Forest Herb", category: CAT_MATERIAL, maxStack: 32 },
];

export const STARTER_LOADOUT: readonly StarterLoadoutEntry[] = [
  { slot: 0, itemId: "sword", count: 1 },
  { slot: 1, itemId: "bow", count: 1 },
  { slot: 2, itemId: "arrow", count: 16 },
  { slot: 3, itemId: "torch", count: 4 },
  { slot: 4, itemId: "bandage", count: 3 },
  { slot: 8, itemId: "map", count: 1 },
  { slot: 9, itemId: "leather-hood", count: 1 },
  { slot: 11, itemId: "wood", count: 8 },
  { slot: 12, itemId: "stone", count: 6 },
  { slot: 13, itemId: "flint", count: 4 },
  { slot: 14, itemId: "raw-meat", count: 3 },
  { slot: 15, itemId: "herb", count: 4 },
  { slot: 18, itemId: "wooden-shield", count: 1 },
];

const ITEM_MAP = new Map<string, ItemDef>(ITEM_CATALOG.map((item) => [item.id, item]));

export function getItemDef(itemId: string): ItemDef | undefined {
  return ITEM_MAP.get(itemId);
}

export function maxStackForItem(itemId: string): number {
  return ITEM_MAP.get(itemId)?.maxStack ?? 64;
}
