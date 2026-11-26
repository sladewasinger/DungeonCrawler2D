/** Shared item, armor, structure, cosmetic, and harvest specification contracts. */
import type { HarvestToolKind, WeaponArchetype } from "./combat.js";
import type { PropKind } from "./world.js";

export type ItemRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export const RARITY_ORDER: readonly ItemRarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

export const ARMOR_SLOT_KEYS = ["head", "chest", "legs", "feet", "offhand"] as const;
export type ArmorSlotKey = (typeof ARMOR_SLOT_KEYS)[number];
export type ArmorSlot = ArmorSlotKey;

export const STRUCTURE_KINDS = ["campfire", "torch", "wood-chest", "workbench", "bed", "palisade"] as const;
export type StructureKind = (typeof STRUCTURE_KINDS)[number];

export type ItemCategory = "weapon" | "tool" | "armor" | "consumable" | "material";
export type ItemWeaponArchetype = Exclude<WeaponArchetype, "unarmed"> | "bow";
export type PlaceableStructureKind = StructureKind;
export type CosmeticLayerSlot = "head" | "face" | "chest" | "sleeves" | "gloves" | "legs" | "feet" | "cape" | "offhand";

export type ItemPerkKind = "bleed" | "burn" | "poison" | "lifesteal" | "thorns" | "glow";
export type PrefixTargetGroup = "weapon" | "tool" | "armor" | "offhand" | "bow";

export interface RecipeIngredientDef {
  readonly itemId: string;
  readonly count: number;
}

export interface RecipeDef {
  readonly id: string;
  readonly outputItemId: string;
  readonly outputCount: number;
  readonly requiresCampfire?: boolean | undefined;
  readonly requiresWorkbench?: boolean | undefined;
  readonly ingredients: readonly RecipeIngredientDef[];
}

export interface HarvestDropSpec {
  readonly itemId: string;
  readonly min: number;
  readonly max: number;
}

export interface HarvestNodeSpec {
  readonly kind: PropKind;
  readonly maxHp: number;
  readonly requiredTool: HarvestToolKind;
  readonly replacementKind: PropKind | null;
  readonly regrowSec: number;
  readonly drops: readonly HarvestDropSpec[];
}
