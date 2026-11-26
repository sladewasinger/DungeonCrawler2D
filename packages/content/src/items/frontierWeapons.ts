/** Curated frontier weapons, bows, tools, and shields spanning Uncommon to Legendary tiers. */
import type { GoreStyle, ItemCategory, ItemDef } from "./catalog.js";

const CAT_WEAPON: ItemCategory = "weapon";
const CAT_TOOL: ItemCategory = "tool";
const CAT_ARMOR: ItemCategory = "armor";
const GORE_STREAK: GoreStyle = "thin-streak";
const GORE_CHUNK: GoreStyle = "chunk-spray";
const GORE_DRIP: GoreStyle = "drip";

export const FRONTIER_WEAPONS: readonly ItemDef[] = [
  {
    id: "copper-pickaxe", name: "Copper Pickaxe", category: CAT_TOOL, maxStack: 1, rarity: "uncommon",
    weaponArchetype: "pickaxe", harvestPower: 42, damage: 18, staminaCost: 12, range: 1.75, arcRad: 1.45, critChance: 0.06,
    goreStyle: GORE_CHUNK, description: "Tempered copper mining pick that cracks rich ore veins and stone armor cleanly.",
  },
  {
    id: "copper-axe", name: "Copper Hatchet", category: CAT_TOOL, maxStack: 1, rarity: "uncommon",
    weaponArchetype: "axe", harvestPower: 42, damage: 24, staminaCost: 15, range: 1.8, arcRad: 1.65, critChance: 0.08,
    goreStyle: GORE_CHUNK, description: "Balanced copper felling axe built to drop mature timber in fewer swings.",
  },
  {
    id: "copper-sword", name: "Copper Broadsword", category: CAT_WEAPON, maxStack: 1, rarity: "uncommon",
    weaponArchetype: "sword", damage: 21, staminaCost: 12, range: 1.9, arcRad: 1.8, critChance: 0.09,
    goreStyle: GORE_STREAK, description: "Reliable frontier blade forged from highland copper ingots.",
  },
  {
    id: "copper-spear", name: "Copper Pike", category: CAT_WEAPON, maxStack: 1, rarity: "uncommon",
    weaponArchetype: "spear", damage: 19, staminaCost: 13, range: 2.45, arcRad: 0.98, critChance: 0.08,
    goreStyle: GORE_DRIP, description: "Extended copper-tipped spear ideal for holding off charging boars behind a shield.",
  },
  {
    id: "bandit-cutlass", name: "Bandit Cutlass", category: CAT_WEAPON, maxStack: 1, rarity: "uncommon",
    weaponArchetype: "sword", damage: 20, staminaCost: 11, range: 1.8, arcRad: 1.85, critChance: 0.14, moveSpeedMult: 0.04,
    goreStyle: GORE_STREAK, description: "Curved raider saber favoring nimble footwork and wicked critical slashes.",
  },
  {
    id: "bog-dagger", name: "Bog Venom Dagger", category: CAT_WEAPON, maxStack: 1, rarity: "uncommon",
    weaponArchetype: "dagger", damage: 14, staminaCost: 7, range: 1.48, arcRad: 1.3, critChance: 0.16, backstabBonus: 0.35,
    perk: "poison", perkValue: 4, goreStyle: GORE_STREAK,
    description: "Swamp-forged stinger coated in fermented bog spore toxin.",
  },
  {
    id: "amber-recurve-bow", name: "Amber Recurve Bow", category: CAT_WEAPON, maxStack: 1, rarity: "rare", weaponArchetype: "bow",
    damage: 27, staminaCost: 13, range: 12.5, critChance: 0.15, bowDrawSpeedMult: 0.2, twoHanded: true,
    goreStyle: GORE_DRIP, description: "Laminated autumn-wood bow sealed with amber resin for rapid, high-velocity draws.",
  },
  {
    id: "frost-hatchet", name: "Highland Cleaver", category: CAT_TOOL, maxStack: 1, rarity: "rare",
    weaponArchetype: "axe", harvestPower: 56, damage: 27, staminaCost: 14, range: 1.85, arcRad: 1.75, critChance: 0.12, perk: "bleed", perkValue: 4,
    goreStyle: GORE_CHUNK, description: "Heavy bearded axe notched by highland warbands to carve deep bleeding wounds.",
  },
  {
    id: "golem-maul", name: "Golem-Core Maul", category: CAT_WEAPON, maxStack: 1, rarity: "rare",
    weaponArchetype: "greatsword", damage: 36, staminaCost: 23, range: 2.25, arcRad: 2.15, critChance: 0.1, critMult: 1.8, twoHanded: true,
    goreStyle: GORE_CHUNK, description: "Crushing stone-and-iron war maul salvaged from an ancient forge.",
  },
  {
    id: "shadowfang-spear", name: "Shadowfang Spear", category: CAT_WEAPON, maxStack: 1, rarity: "epic",
    weaponArchetype: "spear", damage: 25, staminaCost: 12, range: 2.55, arcRad: 1.0, critChance: 0.14,
    stealthVisMult: -0.1, backstabBonus: 0.45, goreStyle: GORE_DRIP,
    description: "Darkened obsidian spear that drinks lantern light and strikes silently from ambush.",
  },
  {
    id: "venom-fang-blade", name: "Venomfang Saber", category: CAT_WEAPON, maxStack: 1, rarity: "epic",
    weaponArchetype: "sword", damage: 26, staminaCost: 11, range: 1.92, arcRad: 1.85, critChance: 0.18,
    perk: "poison", perkValue: 6, goreStyle: GORE_STREAK,
    description: "Etched brood-fang blade seeping corrosive venom on every clean strike.",
  },
  {
    id: "sunforged-greatsword", name: "Sunforged Greatsword", category: CAT_WEAPON, maxStack: 1, rarity: "legendary",
    weaponArchetype: "greatsword", damage: 42, staminaCost: 20, range: 2.35, arcRad: 2.3, critChance: 0.18, critMult: 1.8,
    perk: "burn", perkValue: 6, twoHanded: true, goreStyle: GORE_CHUNK,
    description: "Radiant sunstone blade that ignites foes and sunders cursed darkness.",
  },
  {
    id: "bloodmoon-scythe", name: "Bloodmoon Reaver", category: CAT_WEAPON, maxStack: 1, rarity: "legendary",
    weaponArchetype: "greatsword", damage: 38, staminaCost: 18, range: 2.3, arcRad: 2.25, critChance: 0.22,
    perk: "lifesteal", perkValue: 0.15, twoHanded: true, goreStyle: GORE_STREAK,
    description: "Ancient hooked warblade that siphons vitality from every wound it opens.",
  },
  {
    id: "whisperwind-bow", name: "Whisperwind Longbow", category: CAT_WEAPON, maxStack: 1, rarity: "legendary", weaponArchetype: "bow",
    damage: 34, staminaCost: 12, range: 14, critChance: 0.25, critMult: 1.75, bowDrawSpeedMult: 0.35, moveSpeedMult: 0.06,
    twoHanded: true, goreStyle: GORE_DRIP,
    description: "Featherlight mythic longbow that looses arrows faster than the eye can track.",
  },
  {
    id: "reinforced-shield", name: "Reinforced Shield", category: CAT_ARMOR, maxStack: 1, rarity: "uncommon",
    armorSlot: "offhand", defense: 4, blockMitigation: 0.82, maxHpBonus: 10,
    description: "Copper-banded oak shield offering stout frontal guard and firmer parries.",
  },
  {
    id: "runic-buckler", name: "Runic Buckler", category: CAT_ARMOR, maxStack: 1, rarity: "rare",
    armorSlot: "offhand", defense: 5, blockMitigation: 0.84, critChance: 0.05, perk: "thorns", perkValue: 5,
    description: "Spiked ward buckler that punishes careless melee attackers on impact.",
  },
  {
    id: "aegis-tower-shield", name: "Aegis Tower Shield", category: CAT_ARMOR, maxStack: 1, rarity: "epic",
    armorSlot: "offhand", defense: 8, blockMitigation: 0.9, maxHpBonus: 25, moveSpeedMult: -0.04,
    description: "Massive iron-and-sunstone bulwark built to weather boss slams.",
  },
];
