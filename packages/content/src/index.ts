/** Public exports for @dc2d/content. */
export { BIOME_CATALOG, getBiomeEntry } from "./biomes/biomeCatalog.js";
export type { AmbientParticleTheme, BiomeCatalogEntry, ContentBiomeId, ContentDangerTier } from "./biomes/biomeCatalog.js";
export { ITEM_CATALOG, STARTER_ARMOR, STARTER_LOADOUT, getItemDef, isBowItem, isMeleeItem, isShieldItem, maxStackForItem, resolveBlockMode } from "./items/catalog.js";
export { classifyPoiLootCategory, rollChestLoot, rollEnemyDrop } from "./items/lootTables.js";
export type { LootPoiCategory, RolledLootEntry } from "./items/lootTables.js";
export type {
  ArmorSlot, BlockMode, CosmeticLayerSlot, GoreStyle, ItemBuffEffectSpec, ItemCategory, ItemDef,
  ItemVisualLayerSpec, ItemWeaponArchetype, PlaceableStructureKind, StarterArmorLoadout, StarterLoadoutEntry,
} from "./items/catalog.js";
export { RARITY_META, RARITY_ORDER, bumpRarity, getRarityMeta } from "./items/rarities.js";
export type { ItemRarity, RarityMeta } from "./items/rarities.js";
export { PREFIX_CATALOG, eligiblePrefixesForItem, getPrefixDef, prefixGroupsForItem } from "./items/prefixes.js";
export type { ItemPerkKind, ItemPrefixDef, PrefixTargetGroup } from "./items/prefixes.js";
export { resolveItemInstance } from "./items/statResolver.js";
export type { ResolvedItemStats } from "./items/statResolver.js";
export { RECIPE_CATALOG, getRecipeDef } from "./recipes/recipes.js";
export type { RecipeDef, RecipeIngredientDef } from "./recipes/recipes.js";
export {
  ARMOR_VISUAL_STYLES,
  EYE_PALETTES,
  HAIR_PALETTES,
  SKIN_PALETTES,
  UNDERWEAR_PALETTE,
  getArmorVisualStyle,
} from "./character/palettes.js";
export type { ArmorVisualStyle, HairPalette, ToneTriad } from "./character/palettes.js";
export { FOREST_LIGHT_STYLE, QUALITY_PRESETS } from "./world/palettes.js";
export type { QualityPresetId, QualityPresetSpec } from "./world/palettes.js";
export { ACTIVE_OUTLINE_STYLE } from "./world/outlineConfig.js";
export type { OutlineStyleSpec } from "./world/outlineConfig.js";
