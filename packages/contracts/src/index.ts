/** Public exports for @dc2d/contracts (Tier 1 pure contracts, IDs, and unions). */
export {
  AI_STATES,
  ENTITY_KINDS,
  GORE_STYLES,
  GORE_SUBSTANCES,
  WEAPON_ARCHETYPES,
  WILDLIFE_KINDS,
} from "./combat.js";
export type {
  AiState,
  AmmoKind,
  AttackMotionKind,
  CreatureKind,
  DamageElement,
  DamageKind,
  EffectAction,
  EffectRule,
  EffectTrigger,
  EntityKind,
  GoreStyle,
  GoreSubstance,
  HarvestToolKind,
  WeaponArchetype,
  WildlifeKind,
} from "./combat.js";
export { ARMOR_SLOT_KEYS, RARITY_ORDER, STRUCTURE_KINDS } from "./items.js";
export type {
  ArmorSlot,
  ArmorSlotKey,
  CosmeticLayerSlot,
  HarvestDropSpec,
  HarvestNodeSpec,
  ItemCategory,
  ItemPerkKind,
  ItemRarity,
  ItemWeaponArchetype,
  PlaceableStructureKind,
  PrefixTargetGroup,
  RecipeDef,
  RecipeIngredientDef,
  StructureKind,
} from "./items.js";
export type {
  PropCategory,
  PropCollisionSpec,
  PropCombatSurface,
  PropFoliageOcclusionSpec,
  PropInteractionKind,
  PropSpec,
  PropStealthSpec,
} from "./propSpecTypes.js";
export { CHUNK_SIZE, GROUND_KIND_VALUES, GroundKind, PROP_KIND_VALUES, PropKind, TILE_PX } from "./world.js";
export type { BiomeKind, DangerTier, PoiCategory, PoiKind, PoiLayoutKind } from "./world.js";
