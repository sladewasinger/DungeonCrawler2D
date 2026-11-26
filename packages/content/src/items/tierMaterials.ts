/** Biome materials, smelted ingots, and specialized elixirs. */
import type { ItemCategory, ItemDef } from "./catalog.js";

const CAT_MAT: ItemCategory = "material";
const CAT_CONS: ItemCategory = "consumable";
const STACK = 64;

export const TIER_MATERIALS: readonly ItemDef[] = [
  {
    id: "copper-ingot", name: "Copper Ingot", category: CAT_MAT, maxStack: STACK, rarity: "uncommon",
    description: "Smelted bar of bright highland copper ready for frontier smithing.",
  },
  {
    id: "iron-ingot", name: "Iron Ingot", category: CAT_MAT, maxStack: STACK, rarity: "uncommon",
    description: "Heavy refined iron bar forged over hot hearth coals.",
  },
  {
    id: "amber-resin", name: "Amber Resin", category: CAT_MAT, maxStack: STACK, rarity: "uncommon",
    description: "Golden tree sap harvested from Autumn Woods maples and birches.",
  },
  {
    id: "bog-spore", name: "Glowing Bog Spore", category: CAT_MAT, maxStack: STACK, rarity: "uncommon",
    description: "Potent luminescent mushroom spore gathered in the Misty Bog.",
  },
  {
    id: "sunstone", name: "Highland Sunstone", category: CAT_MAT, maxStack: STACK, rarity: "rare",
    description: "Warm crystalline mineral prized for radiant weapons and wards.",
  },
  {
    id: "shadow-shard", name: "Shadow Shard", category: CAT_MAT, maxStack: STACK, rarity: "rare",
    description: "Cold violet crystal splinter chipped from Cursed Ruinlands obelisks.",
  },
  {
    id: "ancient-core", name: "Ancient Core", category: CAT_MAT, maxStack: STACK, rarity: "epic",
    description: "Humming relic heart recovered from elite lairs and sealed vaults.",
  },
  {
    id: "swiftness-draught", name: "Swiftness Draught", category: CAT_CONS, maxStack: STACK, rarity: "uncommon",
    healHp: 10, buffEffect: { kind: "swiftness", durationSec: 60 },
    description: "Crisp herbal tonic granting +22% movement speed and brisk stamina recovery for 60s.",
  },
  {
    id: "ironbark-tonic", name: "Ironbark Tonic", category: CAT_CONS, maxStack: STACK, rarity: "rare",
    healHp: 20, buffEffect: { kind: "vigor", durationSec: 90 },
    description: "Bitter amber brew granting +25 Max HP and steadfast health regeneration for 90s.",
  },
  {
    id: "shadow-oil", name: "Shadow-Veil Vial", category: CAT_CONS, maxStack: STACK, rarity: "rare",
    buffEffect: { kind: "shadow", durationSec: 75 },
    description: "Dark distillate masking your silhouette (-35% visibility, +40% backstab) for 75s.",
  },
  {
    id: "phoenix-salve", name: "Phoenix Salve", category: CAT_CONS, maxStack: STACK, rarity: "epic",
    healHp: 75, curesStatuses: true,
    description: "Rare alchemical balm restoring 75 HP instantly and cleansing burn, poison, and bleed.",
  },
];
