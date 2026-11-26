/** Deterministic item valuation, Merchant sell prices, Blacksmith upgrade/reforge costs, and Gold drops. */
import type { DangerTier, ItemRarity } from "@dc2d/contracts";
import { getItemDef, type ItemDef } from "./catalog.js";
import { resolveItemInstance } from "./statResolver.js";

const RARITY_BASE_VALUE: Readonly<Record<ItemRarity, number>> = {
  common: 10,
  uncommon: 26,
  rare: 64,
  epic: 140,
  legendary: 320,
};

const RARITY_RANK: Readonly<Record<ItemRarity, number>> = {
  common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4,
};

const CATEGORY_PRICE_MULT: Readonly<Record<ItemDef["category"], number>> = {
  material: 0.8,
  consumable: 1.1,
  tool: 1.4,
  armor: 1.75,
  weapon: 2.0,
};

const SPECIAL_ITEM_VALUES: Readonly<Record<string, number>> = {
  "wood": 4, "stone": 5, "flint": 6, "fiber": 4, "herb": 7, "berry": 4, "raw-meat": 8,
  "arrow": 3, "torch": 8, "bandage": 14, "cooked-meat": 18, "herb-tea": 32, "healing-salve": 36,
  "copper-ore": 14, "iron-ore": 24, "copper-ingot": 28, "iron-ingot": 46, "sunstone": 85,
  "shadow-shard": 95, "ancient-core": 220, "phoenix-salve": 150,
};

export function computeItemValue(opts: {
  readonly itemId: string;
  readonly prefixId?: string | null | undefined;
  readonly upgradeLevel?: number | undefined;
}): number {
  const resolved = resolveItemInstance(opts.itemId, opts.prefixId);
  if (!resolved.def) return 4;
  const special = SPECIAL_ITEM_VALUES[opts.itemId];
  const base = special ?? Math.round(RARITY_BASE_VALUE[resolved.rarity] * CATEGORY_PRICE_MULT[resolved.def.category]);
  const upgrade = Math.max(0, Math.min(3, Math.floor(opts.upgradeLevel ?? 0)));
  return Math.max(4, Math.round(base * (1 + upgrade * 0.4)));
}

export function computeSellPrice(opts: {
  readonly itemId: string;
  readonly prefixId?: string | null | undefined;
  readonly upgradeLevel?: number | undefined;
}): number {
  return Math.max(2, Math.floor(computeItemValue(opts) * 0.5));
}

export interface MaterialCostSpec {
  readonly itemId: string;
  readonly count: number;
}

export function computeReforgeCost(opts: {
  readonly itemId: string;
  readonly prefixId?: string | null | undefined;
}): { readonly gold: number; readonly material: MaterialCostSpec } {
  const rarity = resolveItemInstance(opts.itemId, opts.prefixId).rarity;
  const rank = RARITY_RANK[rarity];
  return {
    gold: 25 + 15 * rank,
    material: { itemId: rank >= 1 ? "copper-ingot" : "flint", count: 1 },
  };
}

export function computeUpgradeCost(currentLevel = 0): {
  readonly gold: number;
  readonly material: MaterialCostSpec;
  readonly nextLevel: number;
} | null {
  const lv = Math.max(0, Math.floor(currentLevel));
  if (lv >= 3) return null;
  if (lv === 0) return { nextLevel: 1, gold: 45, material: { itemId: "copper-ingot", count: 2 } };
  if (lv === 1) return { nextLevel: 2, gold: 95, material: { itemId: "iron-ingot", count: 2 } };
  return { nextLevel: 3, gold: 185, material: { itemId: "sunstone", count: 2 } };
}

const TIER_GOLD_MIN: Readonly<Record<DangerTier, number>> = { 1: 3, 2: 7, 3: 13, 4: 20, 5: 28 };
const TIER_GOLD_SPAN: Readonly<Record<DangerTier, number>> = { 1: 5, 2: 7, 3: 11, 4: 15, 5: 27 };

export function rollGoldDrop(opts: {
  readonly tier: DangerTier;
  readonly isElite?: boolean | undefined;
  readonly unitRoll: number;
}): number {
  const min = TIER_GOLD_MIN[opts.tier];
  const span = TIER_GOLD_SPAN[opts.tier];
  const clamped = Math.max(0, Math.min(0.9999, opts.unitRoll));
  const amount = min + Math.floor(clamped * (span + 1));
  return opts.isElite ? amount * 3 : amount;
}

export function isItemReforgeableOrUpgradeable(itemId: string): boolean {
  const def = getItemDef(itemId);
  if (!def || def.maxStack > 1) return false;
  return def.category === "weapon" || def.category === "tool" || def.category === "armor";
}
