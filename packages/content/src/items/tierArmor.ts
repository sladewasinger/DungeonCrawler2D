/** Four progressed armor sets (Moss Stalker, Autumn Ranger, Iron Knight, Shadowsteel) with recolored 3D layers. */
import type { ItemCategory, ItemDef } from "./catalog.js";

const CAT_ARMOR: ItemCategory = "armor";
const ASSET_HOOD = "armor-head-leather-hood";
const ASSET_CHEST = "armor-chest-leather-tunic";
const ASSET_SLEEVES = "armor-chest-sleeves";
const ASSET_LEGS = "armor-legs-leather-leggings";
const ASSET_BOOTS = "armor-feet-leather-boots";

const MOSS_PRI = "#3f6b3a";
const MOSS_TRIM = "#78a85a";
const AUTUMN_PRI = "#9a4a24";
const AUTUMN_TRIM = "#e09b3d";
const KNIGHT_PRI = "#64748b";
const KNIGHT_TRIM = "#cbd5e1";
const SHADOW_PRI = "#3b2d54";
const SHADOW_TRIM = "#a855f7";

export const TIER_ARMOR: readonly ItemDef[] = [
  {
    id: "moss-stalker-hood", name: "Moss Stalker Hood", category: CAT_ARMOR, maxStack: 1, rarity: "uncommon",
    armorSlot: "head", defense: 3, stealthVisMult: -0.08, backstabBonus: 0.15,
    description: "Leaf-dyed hood woven to break up a scout's silhouette in brush.",
    visualLayer: { slot: "head", assetId: ASSET_HOOD, gendered: false, zOrder: 50, hidesHair: true, recolorPrimary: MOSS_PRI, recolorTrim: MOSS_TRIM },
  },
  {
    id: "moss-stalker-tunic", name: "Moss Stalker Jerkin", category: CAT_ARMOR, maxStack: 1, rarity: "uncommon",
    armorSlot: "chest", defense: 5, stealthVisMult: -0.08, maxStaminaBonus: 10,
    description: "Supple forest-green jerkin padded for silent movement.",
    visualLayer: { slot: "chest", assetId: ASSET_CHEST, sleeveAssetId: ASSET_SLEEVES, gendered: true, zOrder: 30, recolorPrimary: MOSS_PRI, recolorTrim: MOSS_TRIM },
  },
  {
    id: "moss-stalker-leggings", name: "Moss Stalker Trousers", category: CAT_ARMOR, maxStack: 1, rarity: "uncommon",
    armorSlot: "legs", defense: 4, stealthVisMult: -0.06, moveSpeedMult: 0.03,
    description: "Muffled marsh-leather trousers that shed mud and brambles.",
    visualLayer: { slot: "legs", assetId: ASSET_LEGS, gendered: true, zOrder: 20, recolorPrimary: "#335730", recolorTrim: MOSS_TRIM },
  },
  {
    id: "moss-stalker-boots", name: "Moss Stalker Boots", category: CAT_ARMOR, maxStack: 1, rarity: "uncommon",
    armorSlot: "feet", defense: 3, moveSpeedMult: 0.05, stealthVisMult: -0.05,
    description: "Soft-soled boots built to cross snapping twigs without a sound.",
    visualLayer: { slot: "feet", assetId: ASSET_BOOTS, gendered: false, zOrder: 10, recolorPrimary: "#2b4728", recolorTrim: MOSS_TRIM },
  },
  {
    id: "autumn-ranger-hood", name: "Autumn Ranger Cowl", category: CAT_ARMOR, maxStack: 1, rarity: "rare",
    armorSlot: "head", defense: 4, critChance: 0.06, bowDrawSpeedMult: 0.1,
    description: "Amber-trimmed cowl worn by frontier marksmen.",
    visualLayer: { slot: "head", assetId: ASSET_HOOD, gendered: false, zOrder: 50, hidesHair: true, recolorPrimary: AUTUMN_PRI, recolorTrim: AUTUMN_TRIM },
  },
  {
    id: "autumn-ranger-tunic", name: "Autumn Ranger Coat", category: CAT_ARMOR, maxStack: 1, rarity: "rare",
    armorSlot: "chest", defense: 7, critChance: 0.05, staminaRegenBonus: 3,
    description: "Reinforced russet coat with quiver straps and quick-draw shoulders.",
    visualLayer: { slot: "chest", assetId: ASSET_CHEST, sleeveAssetId: ASSET_SLEEVES, gendered: true, zOrder: 30, recolorPrimary: AUTUMN_PRI, recolorTrim: AUTUMN_TRIM },
  },
  {
    id: "autumn-ranger-leggings", name: "Autumn Ranger Breeches", category: CAT_ARMOR, maxStack: 1, rarity: "rare",
    armorSlot: "legs", defense: 5, moveSpeedMult: 0.05, maxStaminaBonus: 12,
    description: "Tough russet riding breeches stitched for long frontier marches.",
    visualLayer: { slot: "legs", assetId: ASSET_LEGS, gendered: true, zOrder: 20, recolorPrimary: "#7c3a1c", recolorTrim: AUTUMN_TRIM },
  },
  {
    id: "autumn-ranger-boots", name: "Autumn Ranger Striders", category: CAT_ARMOR, maxStack: 1, rarity: "rare",
    armorSlot: "feet", defense: 4, moveSpeedMult: 0.08, staminaRegenBonus: 2,
    description: "Springy high-cuffed boots prized by long-range scouts.",
    visualLayer: { slot: "feet", assetId: ASSET_BOOTS, gendered: false, zOrder: 10, recolorPrimary: "#693017", recolorTrim: AUTUMN_TRIM },
  },
  {
    id: "iron-knight-helm", name: "Iron Knight Helm", category: CAT_ARMOR, maxStack: 1, rarity: "rare",
    armorSlot: "head", defense: 6, maxHpBonus: 15,
    description: "Riveted iron great-hood forged to turn aside warband blows.",
    visualLayer: { slot: "head", assetId: ASSET_HOOD, gendered: false, zOrder: 50, hidesHair: true, recolorPrimary: KNIGHT_PRI, recolorTrim: KNIGHT_TRIM },
  },
  {
    id: "iron-knight-cuirass", name: "Iron Knight Cuirass", category: CAT_ARMOR, maxStack: 1, rarity: "rare",
    armorSlot: "chest", defense: 10, maxHpBonus: 25,
    description: "Layered steel breastplate hammered over heavy boiled leather.",
    visualLayer: { slot: "chest", assetId: ASSET_CHEST, sleeveAssetId: ASSET_SLEEVES, gendered: true, zOrder: 30, recolorPrimary: KNIGHT_PRI, recolorTrim: KNIGHT_TRIM },
  },
  {
    id: "iron-knight-greaves", name: "Iron Knight Greaves", category: CAT_ARMOR, maxStack: 1, rarity: "rare",
    armorSlot: "legs", defense: 8, maxHpBonus: 15,
    description: "Tempered thigh-and-shin plates guarding against beast charges.",
    visualLayer: { slot: "legs", assetId: ASSET_LEGS, gendered: true, zOrder: 20, recolorPrimary: "#475569", recolorTrim: KNIGHT_TRIM },
  },
  {
    id: "iron-knight-sabatons", name: "Iron Knight Sabatons", category: CAT_ARMOR, maxStack: 1, rarity: "rare",
    armorSlot: "feet", defense: 6, maxHpBonus: 10,
    description: "Steel-shod boots anchoring the wearer in heavy melee.",
    visualLayer: { slot: "feet", assetId: ASSET_BOOTS, gendered: false, zOrder: 10, recolorPrimary: "#334155", recolorTrim: KNIGHT_TRIM },
  },
  {
    id: "shadowsteel-cowl", name: "Shadowsteel Cowl", category: CAT_ARMOR, maxStack: 1, rarity: "epic",
    armorSlot: "head", defense: 7, critChance: 0.08, stealthVisMult: -0.08,
    description: "Obsidian-violet hood quenched in cursed ruinlight.",
    visualLayer: { slot: "head", assetId: ASSET_HOOD, gendered: false, zOrder: 50, hidesHair: true, recolorPrimary: SHADOW_PRI, recolorTrim: SHADOW_TRIM },
  },
  {
    id: "shadowsteel-coat", name: "Shadowsteel Mail", category: CAT_ARMOR, maxStack: 1, rarity: "epic",
    armorSlot: "chest", defense: 12, maxHpBonus: 25, critChance: 0.06, staminaRegenBonus: 4,
    description: "Articulated dark-alloy mail humming with quiet arcane wardings.",
    visualLayer: { slot: "chest", assetId: ASSET_CHEST, sleeveAssetId: ASSET_SLEEVES, gendered: true, zOrder: 30, recolorPrimary: SHADOW_PRI, recolorTrim: SHADOW_TRIM },
  },
  {
    id: "shadowsteel-legguards", name: "Shadowsteel Legguards", category: CAT_ARMOR, maxStack: 1, rarity: "epic",
    armorSlot: "legs", defense: 9, moveSpeedMult: 0.05, maxStaminaBonus: 15,
    description: "Feather-light cursed steel legplates built for relentless hunters.",
    visualLayer: { slot: "legs", assetId: ASSET_LEGS, gendered: true, zOrder: 20, recolorPrimary: "#2e2242", recolorTrim: SHADOW_TRIM },
  },
  {
    id: "shadowsteel-boots", name: "Shadowsteel Treads", category: CAT_ARMOR, maxStack: 1, rarity: "epic",
    armorSlot: "feet", defense: 7, moveSpeedMult: 0.08, stealthVisMult: -0.08,
    description: "Silent dark-steel boots leaving faint violet motes in the mist.",
    visualLayer: { slot: "feet", assetId: ASSET_BOOTS, gendered: false, zOrder: 10, recolorPrimary: "#241936", recolorTrim: SHADOW_TRIM },
  },
];
