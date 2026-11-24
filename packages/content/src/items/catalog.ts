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
  readonly twoHanded?: boolean;
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
const GORE_THIN_STREAK: GoreStyle = "thin-streak";
const GORE_CHUNK_SPRAY: GoreStyle = "chunk-spray";
const GORE_DRIP: GoreStyle = "drip";
const STACK_LIMIT = 64;

export const ITEM_CATALOG: readonly ItemDef[] = [
  { id: "sword", name: "Iron Sword", category: CAT_WEAPON, maxStack: 1, weaponArchetype: "sword", damage: 18, staminaCost: 12, range: 1.85, arcRad: 1.75, goreStyle: GORE_THIN_STREAK },
  { id: "flint-dagger", name: "Flint Dagger", category: CAT_WEAPON, maxStack: 1, weaponArchetype: "dagger", damage: 11, staminaCost: 7, range: 1.45, arcRad: 1.25, goreStyle: GORE_THIN_STREAK },
  { id: "wooden-spear", name: "Wooden Spear", category: CAT_WEAPON, maxStack: 1, weaponArchetype: "spear", damage: 16, staminaCost: 13, range: 2.35, arcRad: 0.95, goreStyle: GORE_DRIP },
  { id: "iron-greatsword", name: "Iron Greatsword", category: CAT_WEAPON, maxStack: 1, weaponArchetype: "greatsword", damage: 30, staminaCost: 22, range: 2.2, arcRad: 2.2, goreStyle: GORE_CHUNK_SPRAY, twoHanded: true },
  { id: "bow", name: "Hunter Bow", category: CAT_WEAPON, maxStack: 1, damage: 22, staminaCost: 14, range: 11, goreStyle: GORE_DRIP, twoHanded: true },
  { id: "axe", name: "Woodcutter Axe", category: CAT_TOOL, maxStack: 1, weaponArchetype: "axe", damage: 20, staminaCost: 16, range: 1.75, arcRad: 1.6, goreStyle: GORE_CHUNK_SPRAY },
  { id: "pickaxe", name: "Stone Pickaxe", category: CAT_TOOL, maxStack: 1, weaponArchetype: "pickaxe", damage: 14, staminaCost: 14, range: 1.65, arcRad: 1.4, goreStyle: GORE_CHUNK_SPRAY },
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
  { id: "torch", name: "Torch", category: CAT_CONSUMABLE, maxStack: STACK_LIMIT, weaponArchetype: "torch", damage: 10, staminaCost: 10, range: 1.65, arcRad: 1.5, goreStyle: "splatter" },
  { id: "bandage", name: "Bandage", category: CAT_CONSUMABLE, maxStack: STACK_LIMIT, healHp: 25 },
  { id: "cooked-meat", name: "Cooked Meat", category: CAT_CONSUMABLE, maxStack: STACK_LIMIT, healHp: 40, wellFedSec: 180 },
  { id: "berry", name: "Wild Berries", category: CAT_CONSUMABLE, maxStack: STACK_LIMIT, healHp: 12, wellFedSec: 45 },
  { id: "herb-tea", name: "Herbal Tea", category: CAT_CONSUMABLE, maxStack: STACK_LIMIT, healHp: 22, wellFedSec: 150 },
  { id: "healing-salve", name: "Herbal Salve", category: CAT_CONSUMABLE, maxStack: STACK_LIMIT, healHp: 50 },
  { id: "camp-campfire", name: "Campfire Kit", category: CAT_TOOL, maxStack: STACK_LIMIT, placeStructure: "campfire" },
  { id: "standing-torch", name: "Standing Torch", category: CAT_TOOL, maxStack: STACK_LIMIT, placeStructure: "torch" },
  { id: "storage-chest", name: "Storage Chest", category: CAT_TOOL, maxStack: STACK_LIMIT, placeStructure: "wood-chest" },
  { id: "workbench", name: "Workbench", category: CAT_TOOL, maxStack: STACK_LIMIT, placeStructure: "workbench" },
  { id: "camp-bed", name: "Camp Bed", category: CAT_TOOL, maxStack: STACK_LIMIT, placeStructure: "bed" },
  { id: "wood-palisade", name: "Wooden Palisade", category: CAT_TOOL, maxStack: STACK_LIMIT, placeStructure: "palisade" },
  { id: "raw-meat", name: "Raw Meat", category: CAT_MATERIAL, maxStack: STACK_LIMIT },
  { id: "arrow", name: "Arrow", category: CAT_MATERIAL, maxStack: STACK_LIMIT },
  { id: "wood", name: "Wood", category: CAT_MATERIAL, maxStack: STACK_LIMIT },
  { id: "stone", name: "Stone", category: CAT_MATERIAL, maxStack: STACK_LIMIT },
  { id: "flint", name: "Flint", category: CAT_MATERIAL, maxStack: STACK_LIMIT },
  { id: "copper-ore", name: "Copper Ore", category: CAT_MATERIAL, maxStack: STACK_LIMIT },
  { id: "iron-ore", name: "Iron Ore", category: CAT_MATERIAL, maxStack: STACK_LIMIT },
  { id: "herb", name: "Forest Herb", category: CAT_MATERIAL, maxStack: STACK_LIMIT },
];

export const STARTER_LOADOUT: readonly StarterLoadoutEntry[] = [
  { slot: 0, itemId: "wooden-spear", count: 1 },
];

export type BlockMode = "none" | "shield" | "twoHanded";

const ITEM_MAP = new Map<string, ItemDef>(ITEM_CATALOG.map((item) => [item.id, item]));

export function getItemDef(itemId: string): ItemDef | undefined {
  return ITEM_MAP.get(itemId);
}

export function maxStackForItem(itemId: string): number {
  return ITEM_MAP.get(itemId)?.maxStack ?? 64;
}

export function isMeleeItem(itemId: string | null | undefined): boolean {
  return !itemId || Boolean(ITEM_MAP.get(itemId)?.weaponArchetype);
}

export function resolveBlockMode(heldItem: string | null | undefined, offhand: string | null | undefined): BlockMode {
  const def = heldItem ? ITEM_MAP.get(heldItem) : undefined;
  if (def?.twoHanded) return def.weaponArchetype ? "twoHanded" : "none";
  return offhand ? "shield" : "none";
}
