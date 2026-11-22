/** Public exports for @dc2d/content. */
export { ITEM_CATALOG, STARTER_LOADOUT, getItemDef, maxStackForItem } from "./items/catalog.js";
export type { ArmorSlot, ItemCategory, ItemDef, StarterLoadoutEntry } from "./items/catalog.js";
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
export type { ArmorVisualStyle, ToneTriad } from "./character/palettes.js";
export { FOREST_LIGHT_STYLE, QUALITY_PRESETS } from "./world/palettes.js";
export type { QualityPresetId, QualityPresetSpec } from "./world/palettes.js";
