/** Deterministic seeded loot table rollers for overworld chests, POI vaults, and enemy drops. */
import type { ContentBiomeId, ContentDangerTier } from "../biomes/biomeCatalog.js";
import { getItemDef, maxStackForItem } from "./catalog.js";
import { eligiblePrefixesForItem } from "./prefixes.js";
import type { ItemRarity } from "./rarities.js";

export interface RolledLootEntry {
  readonly itemId: string;
  readonly count: number;
  readonly prefixId?: string;
}

export type LootPoiCategory = "bandit-camp" | "ancient-ruins" | "micro" | "lair" | "puzzle" | "friendly";

const ITEM_COOKED_MEAT = "cooked-meat";
const SUPPLY_COMMON = ["arrow", "bandage", ITEM_COOKED_MEAT, "torch", "berry"] as const;
const SUPPLY_HIGH = ["arrow", "healing-salve", ITEM_COOKED_MEAT, "swiftness-draught", "ironbark-tonic", "shadow-oil", "phoenix-salve"] as const;

const BIOME_MATERIALS: Readonly<Record<ContentBiomeId, readonly string[]>> = {
  "verdant-forest": ["wood", "stone", "flint", "herb"],
  "autumn-woods": ["amber-resin", "copper-ore", "wood", "herb"],
  "misty-bog": ["bog-spore", "herb", "flint", "amber-resin"],
  "craggy-highlands": ["copper-ore", "iron-ore", "sunstone", "stone"],
  "cursed-ruinlands": ["shadow-shard", "ancient-core", "iron-ingot", "sunstone"],
};

const GEAR_BY_RARITY: Readonly<Record<ItemRarity, readonly string[]>> = {
  common: ["sword", "flint-dagger", "wooden-spear", "bow", "axe", "pickaxe", "wooden-shield", "leather-hood", "leather-tunic", "leather-leggings", "leather-boots"],
  uncommon: ["copper-sword", "copper-spear", "copper-axe", "copper-pickaxe", "bandit-cutlass", "bog-dagger", "reinforced-shield", "moss-stalker-hood", "moss-stalker-tunic", "moss-stalker-leggings", "moss-stalker-boots"],
  rare: ["iron-greatsword", "amber-recurve-bow", "frost-hatchet", "golem-maul", "runic-buckler", "autumn-ranger-hood", "autumn-ranger-tunic", "autumn-ranger-leggings", "autumn-ranger-boots", "iron-knight-helm", "iron-knight-cuirass", "iron-knight-greaves", "iron-knight-sabatons"],
  epic: ["shadowfang-spear", "venom-fang-blade", "aegis-tower-shield", "shadowsteel-cowl", "shadowsteel-coat", "shadowsteel-legguards", "shadowsteel-boots"],
  legendary: ["sunforged-greatsword", "bloodmoon-scythe", "whisperwind-bow"],
};

const TIER_WEIGHTS: Readonly<Record<ContentDangerTier, readonly [ItemRarity, number][]>> = {
  1: [["common", 0.70], ["uncommon", 0.26], ["rare", 0.04]],
  2: [["common", 0.35], ["uncommon", 0.44], ["rare", 0.18], ["epic", 0.03]],
  3: [["common", 0.12], ["uncommon", 0.38], ["rare", 0.34], ["epic", 0.14], ["legendary", 0.02]],
  4: [["uncommon", 0.22], ["rare", 0.42], ["epic", 0.28], ["legendary", 0.08]],
};

const PREFIX_CHANCE: Readonly<Record<ContentDangerTier, number>> = { 1: 0.2, 2: 0.4, 3: 0.65, 4: 0.85 };
const HIGH_POIS = new Set<string>(["broodmother-hollow", "orc-totem-ring", "golem-forge", "cursed-obelisk", "brazier-vault", "sun-dial-ruin"]);
const FRIENDLY_POIS = new Set<string>(["hermits-hut", "tinker-camp"]);
const ITEM_ANCIENT_CORE = "ancient-core";
const RARITY_LIST: readonly ItemRarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function makeRng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length) % arr.length]!;
}

function rollRarity(tier: ContentDangerTier, rng: () => number, minRarity?: ItemRarity): ItemRarity {
  const weights = TIER_WEIGHTS[tier];
  let r = rng();
  let chosen: ItemRarity = weights[weights.length - 1]![0];
  for (const [rar, w] of weights) {
    if (r < w) { chosen = rar; break; }
    r -= w;
  }
  if (!minRarity) return chosen;
  return RARITY_LIST.indexOf(chosen) >= RARITY_LIST.indexOf(minRarity) ? chosen : minRarity;
}

function maybeRollPrefix(itemId: string, chance: number, rng: () => number): string | undefined {
  if (rng() >= chance) return undefined;
  const def = getItemDef(itemId);
  if (!def) return undefined;
  const pool = eligiblePrefixesForItem(def);
  return pool.length > 0 ? pick(pool, rng).id : undefined;
}

function pushRolledGear(opts: {
  readonly out: RolledLootEntry[];
  readonly rarity: ItemRarity;
  readonly prefixChance: number;
  readonly rng: () => number;
}): void {
  const itemId = pick(GEAR_BY_RARITY[opts.rarity], opts.rng);
  const prefixId = maybeRollPrefix(itemId, opts.prefixChance, opts.rng);
  opts.out.push(prefixId ? { itemId, count: 1, prefixId } : { itemId, count: 1 });
}

function supplyCount(itemId: string, rng: () => number): number {
  if (itemId === "arrow") return 6 + Math.floor(rng() * 10);
  if (itemId === ITEM_COOKED_MEAT || itemId === "bandage") return 1 + Math.floor(rng() * 2);
  return 1;
}

export function classifyPoiLootCategory(poiKind: string): LootPoiCategory {
  if (poiKind === "bandit-camp" || poiKind === "ancient-ruins") return poiKind;
  if (FRIENDLY_POIS.has(poiKind)) return "friendly";
  if (poiKind === "brazier-vault" || poiKind === "sun-dial-ruin") return "puzzle";
  if (HIGH_POIS.has(poiKind)) return "lair";
  return "micro";
}

function appendChestSupplies(opts: {
  readonly out: RolledLootEntry[]; readonly cat: LootPoiCategory; readonly tier: ContentDangerTier; readonly rng: () => number;
}): void {
  const countSlots = 1 + Math.floor(opts.rng() * 2);
  const pool = opts.tier >= 2 || opts.cat === "friendly" ? SUPPLY_HIGH : SUPPLY_COMMON;
  for (let i = 0; i < countSlots; i++) {
    const itemId = pick(pool, opts.rng);
    opts.out.push({ itemId, count: Math.min(maxStackForItem(itemId), supplyCount(itemId, opts.rng)) });
  }
}

function appendChestMaterials(opts: {
  readonly out: RolledLootEntry[]; readonly isVault: boolean; readonly biome: ContentBiomeId; readonly rng: () => number;
}): void {
  const mats = BIOME_MATERIALS[opts.biome];
  const matSlots = opts.isVault ? 2 : 1 + Math.floor(opts.rng() * 2);
  for (let i = 0; i < matSlots; i++) opts.out.push({ itemId: pick(mats, opts.rng), count: 2 + Math.floor(opts.rng() * 4) });
  if (opts.isVault) opts.out.push({ itemId: ITEM_ANCIENT_CORE, count: 1 });
}

function vaultMinRarity(isVault: boolean, tier: ContentDangerTier): ItemRarity | undefined {
  if (!isVault) return undefined;
  return tier >= 3 ? "epic" : "rare";
}

function appendChestGear(opts: {
  readonly out: RolledLootEntry[]; readonly isVault: boolean; readonly tier: ContentDangerTier; readonly rng: () => number;
}): void {
  const gearSlots = opts.isVault ? 2 : 1 + (opts.rng() < 0.45 ? 1 : 0);
  const baseMin = vaultMinRarity(opts.isVault, opts.tier);
  for (let i = 0; i < gearSlots; i++) {
    const rarity = rollRarity(opts.tier, opts.rng, i === 0 ? baseMin : undefined);
    pushRolledGear({ out: opts.out, rarity, prefixChance: PREFIX_CHANCE[opts.tier], rng: opts.rng });
  }
}

export function rollChestLoot(opts: {
  readonly worldSeed: number;
  readonly chestId: string;
  readonly poiKind: string;
  readonly biome: ContentBiomeId;
  readonly dangerTier: ContentDangerTier;
}): RolledLootEntry[] {
  const rng = makeRng(opts.worldSeed ^ hashString(opts.chestId));
  const out: RolledLootEntry[] = [];
  const cat = classifyPoiLootCategory(opts.poiKind);
  const isVault = cat === "lair" || cat === "puzzle";
  appendChestSupplies({ out, cat, tier: opts.dangerTier, rng });
  appendChestMaterials({ out, isVault, biome: opts.biome, rng });
  appendChestGear({ out, isVault, tier: opts.dangerTier, rng });
  return out;
}

const MEAT_MOBS = new Set<string>(["wolf", "boar", "bear"]);

function appendEliteEnemyDrops(out: RolledLootEntry[], dangerTier: ContentDangerTier, rng: () => number): RolledLootEntry[] {
  out.push({ itemId: dangerTier >= 3 ? ITEM_ANCIENT_CORE : "sunstone", count: 1 + (rng() < 0.4 ? 1 : 0) });
  const rar = rollRarity(dangerTier, rng, dangerTier >= 3 ? "rare" : "uncommon");
  pushRolledGear({ out, rarity: rar, prefixChance: 0.9, rng });
  return out;
}

export function rollEnemyDrop(opts: {
  readonly seed: number;
  readonly kind: string;
  readonly biome: ContentBiomeId;
  readonly dangerTier: ContentDangerTier;
  readonly isElite: boolean;
}): RolledLootEntry[] {
  const rng = makeRng(opts.seed ^ hashString(opts.kind));
  const out: RolledLootEntry[] = [];
  const mats = BIOME_MATERIALS[opts.biome];
  if (MEAT_MOBS.has(opts.kind)) out.push({ itemId: "raw-meat", count: opts.kind === "bear" ? 2 : 1 });
  out.push({ itemId: pick(mats, rng), count: opts.isElite ? 2 : 1 });
  if (opts.isElite) return appendEliteEnemyDrops(out, opts.dangerTier, rng);
  if (rng() < 0.04 + opts.dangerTier * 0.03) {
    pushRolledGear({ out, rarity: rollRarity(opts.dangerTier, rng, "uncommon"), prefixChance: PREFIX_CHANCE[opts.dangerTier], rng });
  }
  return out;
}
