/** Authoritative item definitions with rarity, descriptions, stack limits, and full RPG stats. */
import { FRONTIER_ARMOR } from "./frontierArmor.js";
import { FRONTIER_MATERIALS } from "./frontierMaterials.js";
import { FRONTIER_WEAPONS } from "./frontierWeapons.js";
import type { ItemPerkKind } from "./prefixes.js";
import type { ItemRarity } from "./rarities.js";

export type ItemCategory = "weapon" | "tool" | "armor" | "consumable" | "material";
export type ItemWeaponArchetype = "sword" | "axe" | "pickaxe" | "torch" | "spear" | "dagger" | "greatsword" | "bow";
export type PlaceableStructureKind = "campfire" | "torch" | "wood-chest" | "workbench" | "bed" | "palisade";
export type ArmorSlot = "head" | "chest" | "legs" | "feet" | "offhand";
export type GoreStyle = "splatter" | "thin-streak" | "drip" | "chunk-spray" | "explode-away";
export type CosmeticLayerSlot = "head" | "face" | "chest" | "sleeves" | "gloves" | "legs" | "feet" | "cape" | "offhand";

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

export interface ItemBuffEffectSpec {
  readonly kind: "swiftness" | "vigor" | "shadow";
  readonly durationSec: number;
}

export interface ItemDef {
  readonly id: string;
  readonly name: string;
  readonly category: ItemCategory;
  readonly maxStack: number;
  readonly rarity?: ItemRarity;
  readonly description?: string;
  readonly armorSlot?: ArmorSlot;
  readonly defense?: number;
  readonly blockMitigation?: number;
  readonly damage?: number;
  readonly harvestPower?: number;
  readonly staminaCost?: number;
  readonly range?: number;
  readonly arcRad?: number;
  readonly critChance?: number;
  readonly critMult?: number;
  readonly maxHpBonus?: number;
  readonly maxStaminaBonus?: number;
  readonly staminaRegenBonus?: number;
  readonly moveSpeedMult?: number;
  readonly stealthVisMult?: number;
  readonly backstabBonus?: number;
  readonly bowDrawSpeedMult?: number;
  readonly perk?: ItemPerkKind;
  readonly perkValue?: number;
  readonly buffEffect?: ItemBuffEffectSpec;
  readonly curesStatuses?: boolean;
  readonly weaponArchetype?: ItemWeaponArchetype;
  readonly placeStructure?: PlaceableStructureKind;
  readonly healHp?: number;
  readonly wellFedSec?: number;
  readonly goreStyle?: GoreStyle;
  readonly twoHanded?: boolean;
  readonly visualLayer?: ItemVisualLayerSpec;
}

export interface StarterLoadoutEntry { readonly slot: number; readonly itemId: string; readonly count: number; }
export interface StarterArmorLoadout { readonly head: string | null; readonly chest: string | null; readonly legs: string | null; readonly feet: string | null; readonly offhand: string | null; }

export const STARTER_ARMOR: StarterArmorLoadout = {
  head: null, chest: "leather-tunic", legs: "leather-leggings", feet: "leather-boots", offhand: null,
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

const BASE_ITEMS: readonly ItemDef[] = [
  {
    id: "sword", name: "Iron Sword", category: CAT_WEAPON, maxStack: 1, rarity: "uncommon", weaponArchetype: "sword",
    damage: 18, staminaCost: 12, range: 1.85, arcRad: 1.75, critChance: 0.08, goreStyle: GORE_THIN_STREAK,
    description: "Dependable double-edged iron blade suited for crisp 3-hit combos.",
  },
  {
    id: "flint-dagger", name: "Flint Dagger", category: CAT_WEAPON, maxStack: 1, rarity: "common", weaponArchetype: "dagger",
    damage: 11, staminaCost: 7, range: 1.45, arcRad: 1.25, critChance: 0.12, backstabBonus: 0.25, goreStyle: GORE_THIN_STREAK,
    description: "Knapped flint ambush knife built for lethal stealth backstabs.",
  },
  {
    id: "wooden-spear", name: "Wooden Spear", category: CAT_WEAPON, maxStack: 1, rarity: "common", weaponArchetype: "spear",
    damage: 16, staminaCost: 13, range: 2.35, arcRad: 0.95, critChance: 0.05, goreStyle: GORE_DRIP,
    description: "Long fire-hardened spear capable of poking safely from behind a raised shield.",
  },
  {
    id: "iron-greatsword", name: "Iron Greatsword", category: CAT_WEAPON, maxStack: 1, rarity: "rare", weaponArchetype: "greatsword",
    damage: 30, staminaCost: 22, range: 2.2, arcRad: 2.2, critChance: 0.08, critMult: 1.75, goreStyle: GORE_CHUNK_SPRAY, twoHanded: true,
    description: "Sweeping two-handed claymore that cleaves packs and shatters guards.",
  },
  {
    id: "bow", name: "Hunter Bow", category: CAT_WEAPON, maxStack: 1, rarity: "common", weaponArchetype: "bow",
    damage: 22, staminaCost: 14, range: 11, critChance: 0.1, goreStyle: GORE_DRIP, twoHanded: true,
    description: "Supple ashwood hunting bow. Draw to focus power and loose recoverable arrows.",
  },
  {
    id: "axe", name: "Woodcutter Axe", category: CAT_TOOL, maxStack: 1, rarity: "common", weaponArchetype: "axe",
    harvestPower: 28, damage: 20, staminaCost: 16, range: 1.75, arcRad: 1.6, critChance: 0.06, goreStyle: GORE_CHUNK_SPRAY,
    description: "Heavy stone-head hatchet for felling timber and splitting skulls alike.",
  },
  {
    id: "pickaxe", name: "Stone Pickaxe", category: CAT_TOOL, maxStack: 1, rarity: "common", weaponArchetype: "pickaxe",
    harvestPower: 28, damage: 14, staminaCost: 14, range: 1.65, arcRad: 1.4, goreStyle: GORE_CHUNK_SPRAY,
    description: "Essential miner's pick required to fracture highland Copper and Iron ore veins.",
  },
  {
    id: "wooden-shield", name: "Wooden Shield", category: CAT_ARMOR, maxStack: 1, rarity: "common",
    armorSlot: "offhand", defense: 2, blockMitigation: 0.75,
    description: "Sturdy plank roundshield that absorbs heavy blows and parries timed strikes.",
  },
  {
    id: "leather-hood", name: "Leather Hood", category: CAT_ARMOR, maxStack: 1, rarity: "common", armorSlot: "head", defense: 2,
    description: "Tanned traveler's hood offering light protection from wind and claws.",
    visualLayer: { slot: "head", assetId: "armor-head-leather-hood", gendered: false, zOrder: 50, hidesHair: true },
  },
  {
    id: "leather-tunic", name: "Leather Tunic", category: CAT_ARMOR, maxStack: 1, rarity: "common", armorSlot: "chest", defense: 4,
    description: "Stitched hide jerkin worn by overworld rangers and scouts.",
    visualLayer: { slot: "chest", assetId: "armor-chest-leather-tunic", sleeveAssetId: "armor-chest-sleeves", gendered: true, zOrder: 30 },
  },
  {
    id: "leather-leggings", name: "Leather Leggings", category: CAT_ARMOR, maxStack: 1, rarity: "common", armorSlot: "legs", defense: 3,
    description: "Flexible hide trousers built for scrambling up craggy trails.",
    visualLayer: { slot: "legs", assetId: "armor-legs-leather-leggings", gendered: true, zOrder: 20 },
  },
  {
    id: "leather-boots", name: "Leather Boots", category: CAT_ARMOR, maxStack: 1, rarity: "common", armorSlot: "feet", defense: 2,
    description: "Worn trail boots that keep gravel and marsh mud out.",
    visualLayer: { slot: "feet", assetId: "armor-feet-leather-boots", gendered: false, zOrder: 10 },
  },
  {
    id: "torch", name: "Torch", category: CAT_CONSUMABLE, maxStack: STACK_LIMIT, rarity: "common", weaponArchetype: "torch",
    damage: 10, staminaCost: 10, range: 1.65, arcRad: 1.5, perk: "burn", perkValue: 4, goreStyle: "splatter",
    description: "Pitch-soaked firebrand that ignites foes, burns spiderwebs, and lights ancient braziers.",
  },
  { id: "bandage", name: "Bandage", category: CAT_CONSUMABLE, maxStack: STACK_LIMIT, rarity: "common", healHp: 25, description: "Clean linen wrap restoring 25 HP." },
  { id: "cooked-meat", name: "Cooked Meat", category: CAT_CONSUMABLE, maxStack: STACK_LIMIT, rarity: "common", healHp: 40, wellFedSec: 180, description: "Seared campfire cut restoring 40 HP and granting Well-Fed." },
  { id: "berry", name: "Wild Berries", category: CAT_CONSUMABLE, maxStack: STACK_LIMIT, rarity: "common", healHp: 12, wellFedSec: 45, description: "Sweet forest berries offering quick nourishment." },
  { id: "herb-tea", name: "Herbal Tea", category: CAT_CONSUMABLE, maxStack: STACK_LIMIT, rarity: "uncommon", healHp: 22, wellFedSec: 150, description: "Warm steeped tea refreshing health and endurance." },
  { id: "healing-salve", name: "Herbal Salve", category: CAT_CONSUMABLE, maxStack: STACK_LIMIT, rarity: "uncommon", healHp: 50, description: "Concentrated green poultice restoring 50 HP." },
  { id: "camp-campfire", name: "Campfire Kit", category: CAT_TOOL, maxStack: STACK_LIMIT, rarity: "common", placeStructure: "campfire", description: "Placeable stone hearth for cooking, smelting, and Rested warmth." },
  { id: "standing-torch", name: "Standing Torch", category: CAT_TOOL, maxStack: STACK_LIMIT, rarity: "common", placeStructure: "torch", description: "Tall camp post illuminating dark clearings and keeping wolves wary." },
  { id: "storage-chest", name: "Storage Chest", category: CAT_TOOL, maxStack: STACK_LIMIT, rarity: "common", placeStructure: "wood-chest", description: "27-slot timber coffer for stashing frontier hauls." },
  { id: "workbench", name: "Workbench", category: CAT_TOOL, maxStack: STACK_LIMIT, rarity: "uncommon", placeStructure: "workbench", description: "Craftsman's bench unlocking copper, iron, and frontier gear recipes." },
  { id: "camp-bed", name: "Camp Bed", category: CAT_TOOL, maxStack: STACK_LIMIT, rarity: "common", placeStructure: "bed", description: "Sets your personal respawn camp when interacted with." },
  { id: "wood-palisade", name: "Wooden Palisade", category: CAT_TOOL, maxStack: STACK_LIMIT, rarity: "common", placeStructure: "palisade", description: "Sharpened defensive wall blocking charging beasts." },
  { id: "raw-meat", name: "Raw Meat", category: CAT_MATERIAL, maxStack: STACK_LIMIT, rarity: "common", description: "Fresh beast cut ready to cook over a campfire." },
  { id: "arrow", name: "Arrow", category: CAT_MATERIAL, maxStack: STACK_LIMIT, rarity: "common", description: "Flint-tipped fletched arrow. Can often be recovered after firing." },
  { id: "wood", name: "Wood", category: CAT_MATERIAL, maxStack: STACK_LIMIT, rarity: "common", description: "Split timber used in tools, shields, and camp structures." },
  { id: "stone", name: "Stone", category: CAT_MATERIAL, maxStack: STACK_LIMIT, rarity: "common", description: "Rough granite chunk used for tools, hearths, and distractions." },
  { id: "flint", name: "Flint", category: CAT_MATERIAL, maxStack: STACK_LIMIT, rarity: "common", description: "Sharp dark stone chip prized for daggers, arrows, and sparks." },
  { id: "copper-ore", name: "Copper Ore", category: CAT_MATERIAL, maxStack: STACK_LIMIT, rarity: "uncommon", description: "Raw greenish-gold copper seam mined from highland rock." },
  { id: "iron-ore", name: "Iron Ore", category: CAT_MATERIAL, maxStack: STACK_LIMIT, rarity: "uncommon", description: "Dense metallic ore veined inside deep highland boulders." },
  { id: "herb", name: "Forest Herb", category: CAT_MATERIAL, maxStack: STACK_LIMIT, rarity: "uncommon", description: "Aromatic wildflower sprig used in bandages, teas, and elixirs." },
];

export const ITEM_CATALOG: readonly ItemDef[] = [...BASE_ITEMS, ...FRONTIER_WEAPONS, ...FRONTIER_ARMOR, ...FRONTIER_MATERIALS];

export const STARTER_LOADOUT: readonly StarterLoadoutEntry[] = [{ slot: 0, itemId: "wooden-spear", count: 1 }];
export type BlockMode = "none" | "shield" | "twoHanded";
const ITEM_MAP = new Map<string, ItemDef>(ITEM_CATALOG.map((item) => [item.id, item]));

export function getItemDef(itemId: string): ItemDef | undefined { return ITEM_MAP.get(itemId); }
export function maxStackForItem(itemId: string): number { return ITEM_MAP.get(itemId)?.maxStack ?? 64; }
export function isMeleeItem(itemId: string | null | undefined): boolean {
  if (!itemId) return true;
  const arch = ITEM_MAP.get(itemId)?.weaponArchetype;
  return Boolean(arch && arch !== "bow");
}
export function isBowItem(itemId: string | null | undefined): boolean {
  return Boolean(itemId && ITEM_MAP.get(itemId)?.weaponArchetype === "bow");
}
export function isShieldItem(itemId: string | null | undefined): boolean {
  if (!itemId) return false;
  const def = ITEM_MAP.get(itemId);
  return Boolean(def && def.armorSlot === "offhand" && (def.blockMitigation ?? 0) > 0);
}
export function resolveBlockMode(heldItem: string | null | undefined, offhand: string | null | undefined): BlockMode {
  const def = heldItem ? ITEM_MAP.get(heldItem) : undefined;
  if (def?.twoHanded) return def.weaponArchetype && def.weaponArchetype !== "bow" ? "twoHanded" : "none";
  return offhand ? "shield" : "none";
}
