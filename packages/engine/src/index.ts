/** Public API for @dc2d/engine. */
export { clamp, fbm2d, hash2d, hashUnit2d, lerp, ridgeNoise2d, smoothstep, valueNoise2d } from "./math/noise.js";
export type { FbmOptions } from "./math/noise.js";
export {
  CHUNK_SIZE,
  GroundKind,
  PropKind,
  TILE_PX,
  chunkKey,
  worldTileIndex,
  worldToChunkCoord,
  worldToLocalCoord,
} from "./world/types.js";
export type { BiomeKind, ChunkProp, PointLightSpec, WorldChunk } from "./world/types.js";
export { sampleWorldTile } from "./world/biomeSampler.js";
export type { TileSample } from "./world/biomeSampler.js";
export { generateChunk } from "./world/chunkGenerator.js";
export { WorldChunkCache, resolveMovement } from "./world/collision.js";
export type { MovementQuery, MovementResult, TileLookup } from "./world/collision.js";
export {
  ELEVATION_DROP_TO_JUMP_Z,
  JUMP_GRAVITY_TILES_PER_SEC2,
  JUMP_VELOCITY_TILES_PER_SEC,
  JUMP_VISUAL_PX_PER_TILE,
  stepJumpArc,
} from "./world/jumpPhysics.js";
export type { JumpState } from "./world/jumpPhysics.js";
export { DAY_DURATION_SECONDS, periodForPhase, sampleDayNight, wrapDayPhase } from "./time/dayNight.js";
export type { DayNightState, RgbTuple, TimeOfDayPeriod } from "./time/dayNight.js";
export {
  BACKPACK_SLOT_COUNT,
  HOTBAR_SLOT_COUNT,
  TOTAL_INVENTORY_SLOTS,
  consumeItemFromSlots,
  createEmptyInventoryState,
  insertIntoSlots,
  moveOrSwapSlot,
} from "./inventory/slotModel.js";
export type {
  ArmorEquipment,
  ArmorSlotKey,
  InventorySlot,
  PlayerInventoryState,
  SlotItem,
  StackLimitLookup,
} from "./inventory/slotModel.js";
export {
  ARMOR_SLOT_KEYS,
  cloneInventoryState,
  computeArmorDefense,
  equipArmorFromSlot,
  unequipArmorToSlot,
} from "./inventory/armorOps.js";
export type { ArmorItemRule, ArmorRuleLookup } from "./inventory/armorOps.js";
export { canCraftRecipe, countItemInSlots, craftRecipeInState } from "./inventory/crafting.js";
export type { CraftRecipe, RecipeIngredient } from "./inventory/crafting.js";
export {
  BODY_STYLES,
  BodyStyleSchema,
  CharacterAppearanceSchema,
  DEFAULT_APPEARANCE,
  EYE_COLORS,
  EyeColorIdSchema,
  HAIR_COLORS,
  HAIR_STYLES,
  HairColorIdSchema,
  HairStyleIdSchema,
  SKIN_TONES,
  SkinToneIdSchema,
  sanitizeCharacterAppearance,
} from "./character/appearance.js";
export type {
  BodyStyle,
  CharacterAppearance,
  EyeColorId,
  HairColorId,
  HairStyleId,
  SkinToneId,
} from "./character/appearance.js";
export {
  ArmorSlotKeySchema,
  ClientMessageSchema,
  GoreStyleSchema,
  GoreSubstanceSchema,
  InventorySnapshotSchema,
  PROTOCOL_VERSION,
  ProjectileSnapshotSchema,
  ServerMessageSchema,
  WorldEntitySnapshotSchema,
  WorldEventSchema,
} from "./net/protocol.js";
export type {
  ClientMessage,
  InventorySnapshot,
  PlayerSnapshot,
  ProjectileSnapshot,
  ServerMessage,
  WorldEntitySnapshot,
  WorldEvent,
} from "./net/protocol.js";
export {
  BLEED_DURATION_SEC,
  BOW_MAX_CHARGE_SEC,
  COMBAT_TUNING,
  COMBO_DAMAGE_MULT,
  COMBO_SWING_SEC,
  COMBO_WINDOW_SEC,
  DODGE_COOLDOWN_SEC,
  DODGE_DURATION_SEC,
  DODGE_IFRAME_SEC,
  DODGE_SPEED_MULT,
  DODGE_STAMINA_COST,
  GORE_STYLES,
  GORE_SUBSTANCES,
  MAX_PLAYER_HP,
  MAX_PLAYER_STAMINA,
  PARRY_STAGGER_SEC,
  PARRY_WINDOW_SEC,
  SANCTUARY_CENTER,
  SANCTUARY_RADIUS,
  STAMINA_REGEN_PER_SEC,
  comboMultiplier,
  computeMitigatedDamage,
  evaluateBowShot,
  isInSanctuary,
  isWithinSector,
} from "./combat/combatRules.js";
export type { GoreStyle, GoreSubstance, Vec2Like } from "./combat/combatRules.js";
