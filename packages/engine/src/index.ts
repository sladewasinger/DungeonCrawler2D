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
  InventorySnapshotSchema,
  PROTOCOL_VERSION,
  ServerMessageSchema,
} from "./net/protocol.js";
export type {
  ClientMessage,
  InventorySnapshot,
  PlayerSnapshot,
  ServerMessage,
} from "./net/protocol.js";
