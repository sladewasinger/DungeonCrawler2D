/** Public API for @dc2d/engine. */
export { clamp, fbm2d, hash2d, hashUnit2d, lerp, ridgeNoise2d, smoothstep, valueNoise2d } from "./math/noise.js";
export type { FbmOptions } from "./math/noise.js";
export { PROP_SPECS, getPropSpec } from "@dc2d/content";
export {
  CHUNK_SIZE,
  GROUND_KIND_VALUES,
  GroundKind,
  PROP_KIND_VALUES,
  PropKind,
  TILE_PX,
} from "@dc2d/contracts";
export type {
  DamageElement,
  DamageKind,
  EffectAction,
  EffectRule,
  EffectTrigger,
  PropSpec,
} from "@dc2d/contracts";
export {
  chunkKey,
  worldTileIndex,
  worldToChunkCoord,
  worldToLocalCoord,
} from "./world/types.js";
export type { BiomeKind, ChunkPoi, ChunkProp, DangerTier, PoiCategory, PoiKind, PoiLayoutKind, PointLightSpec, WorldChunk } from "./world/types.js";
export { POI_CATALOG, POI_CATALOG_LIST, TOTAL_POI_TYPES, getPoiCatalogEntry, pickBiomeWeightedPoiKind } from "./world/pois/poiCatalog.js";
export type { PoiCatalogEntry } from "./world/pois/poiCatalog.js";
export { TIER_DISTANCES, biomeBaseDangerTier, computeDangerTier, distanceDangerTier, sampleMacroBiome } from "./world/biomes/macroBiome.js";
export { sampleWorldTile } from "./world/biomeSampler.js";
export type { TileSample } from "./world/biomeSampler.js";
export { generateChunk } from "./world/chunkGenerator.js";
export { findChunkPoi, isInsidePoiFootprint, poiFloorGround, stampPoiPropsAndLights } from "./world/poiStamper.js";
export { getPoiGuardRoster } from "./world/poiLayouts.js";
export { WorldChunkCache, resolveMovement } from "./world/collision.js";
export type { BlockingObstacle, MovementQuery, MovementResult, TileLookup } from "./world/collision.js";
export { SpatialHashGrid, type SpatialPoint } from "./world/spatialHashGrid.js";
export {
  POI_CHEST_OBSTACLE_SHAPE,
  closestObstacleCorePoint,
  obstacleToColliderShape,
  propCollisionOffsetY,
  propFootprintCenter,
  propStructureShape,
} from "./world/propFootprints.js";
export type { GroundColliderShape } from "./world/propFootprints.js";
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
  BACKPACK_SLOT_COUNT, HOTBAR_SLOT_COUNT, TOTAL_INVENTORY_SLOTS,
  canInsertSlotItem, consumeItemFromSlots, createEmptyInventoryState,
  insertIntoSlots, makeSlotItem, moveOrSwapSlot, removeFromSlot,
} from "./inventory/slotModel.js";
export type {
  ArmorEquipment, ArmorPrefixMap, ArmorSlotKey, InventorySlot,
  PlayerInventoryState, SlotItem, StackLimitLookup,
} from "./inventory/slotModel.js";
export { computePlayerGearStats } from "./inventory/gearStats.js";
export type { AggregatedPlayerGearStats, GearPerkKind, GearPieceStats, GearStatsLookup } from "./inventory/gearStats.js";
export {
  ARMOR_SLOT_KEYS,
  cloneInventoryState,
  computeArmorDefense,
  equipArmorFromSlot,
  unequipArmorToSlot,
} from "./inventory/armorOps.js";
export type { ArmorItemRule, ArmorRuleLookup } from "./inventory/armorOps.js";
export {
  CHEST_SLOT_COUNT,
  createEmptyChestSlots,
  quickTransferChestSlot,
  takeAllFromChest,
  transferChestSlot,
} from "./inventory/chestOps.js";
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
  CharacterAppearance,
  HairStyleId,
} from "./character/appearance.js";
export {
  ArmorSlotKeySchema, ChatEntrySchema, ClientAdminSchema, ClientChatSchema, ClientDropItemSchema,
  ClientMessageSchema, ClientPingSchema, ClientUseItemSchema, DiscoveryStateSchema, GoreStyleSchema, GoreSubstanceSchema,
  GroundLootSnapshotSchema, InventorySnapshotSchema, PROTOCOL_VERSION, PlayerBubbleSchema,
  ProjectileSnapshotSchema, ServerMessageSchema, ServerPongSchema, SlotItemSchema, WorldChestSnapshotSchema,
  WorldEntitySnapshotSchema, WorldEventSchema, WorldWebSnapshotSchema,
} from "./net/protocol.js";
export { CHAT_BUBBLE_DURATION_SEC, MAX_CHAT_LENGTH, PROXIMITY_CHAT_RADIUS, PROXIMITY_SHOUT_RADIUS } from "./net/chatSchemas.js";
export type {
  ChatEntry, ClientMessage, CreatureVocalKind, DiscoveryStateSnapshot, DropItemRequest, GroundLootSnapshot, InventorySnapshot,
  PlayerBubble, PlayerSnapshot, ProjectileSnapshot, RevealedBeacon, ServerMessage,
  WorldChestSnapshot, WorldEntitySnapshot, WorldEvent, WorldWebSnapshot,
} from "./net/protocol.js";
export {
  BLEED_DURATION_SEC,
  BOW_MAX_CHARGE_SEC,
  COMBAT_TUNING,
  COMBO_SWING_SEC,
  DODGE_COOLDOWN_SEC,
  DODGE_DURATION_SEC,
  DODGE_IFRAME_SEC,
  DODGE_SPEED_MULT,
  DODGE_STAMINA_COST,
  ELEVATION_LIFT_TILES,
  GORE_STYLES,
  GORE_SUBSTANCES,
  HIT_IFRAME_SEC,
  MAX_PLAYER_HP,
  MAX_PLAYER_STAMINA,
  PARRY_STAGGER_SEC,
  PARRY_WINDOW_SEC,
  SANCTUARY_CENTER,
  SANCTUARY_RADIUS,
  STAMINA_REGEN_PER_SEC,
  computeMitigatedDamage,
  entityFootRadius,
  evaluateBowShot,
  isInSanctuary,
  isInWorldSanctuary,
  isWithinSector,
  segmentHitsEllipse,
} from "./combat/combatRules.js";
export type { EllipseHurtbox, GoreStyle, GoreSubstance, Vec2Like } from "./combat/combatRules.js";
export {
  computeCharacterMoveMultiplier,
  swingMoveSpeedMult,
  type CharacterKinematicsInput,
} from "./combat/kinematics.js";
export {
  ENTITY_ATTACK_SPECS,
  ENTITY_HURTBOX_SPECS,
  PLAYER_FOOT_FORESHORTEN_Y,
  attackHitboxHitsHurtbox,
  buildEntityAttackHitbox,
  buildPlayerAttackHitbox,
  canAttackReachElevation,
  canReachMeleeTarget,
  entityFootCollider,
  entityHurtbox,
  getEntityAttackSpec,
  playerFootCollider,
  playerFootSegment,
  playerHurtbox,
  projectileHitsHurtbox,
  resolveEntityAttackHitbox,
  resolvePlayerAttackHitbox,
} from "./combat/hitboxes/combatShapes.js";
export type {
  ActorPositionInput,
  AttackHitbox,
  EntityAttackSpec,
  HurtboxSpec,
  PlayerStanceInput,
  PlayerWeaponHitboxStats,
  ProjectileHitQuery,
} from "./combat/hitboxes/combatShapes.js";
export { WALK_CYCLE_TILES, RUN_CYCLE_TILES, createGaitClock, advanceGaitClock, gaitFrameIndex } from "./combat/gaitClock.js";
export type { GaitClock, GaitStepInput, GaitStepResult } from "./combat/gaitClock.js";
export {
  AI_STATES,
  AI_TUNING,
  ENTITY_KINDS,
  canHearTarget,
  canPerceiveTarget,
  computeFlankRingSlot,
  computeLineOfSightClarity,
  hasClearChargeLane,
  hasElevationLineOfSight,
} from "./combat/aiSensing.js";
export type { AiState, ChargeLaneQuery, EntityKind, LosQuery, PerceptionQuery } from "./combat/aiSensing.js";
export { findTilePath } from "./combat/pathfinding.js";
export type { PathQuery, PathResult, TileWaypoint } from "./combat/pathfinding.js";
export { STEALTH_TUNING, isBackstabAngle, sampleStealthExposure } from "./combat/stealthRules.js";
export type { StealthExposure, StealthQuery } from "./combat/stealthRules.js";
export {
  MELEE_FEEL_TUNING, WEIGHT_FEEL_PRESETS, isArmorCrushTarget, isBurnVulnerable, isSharpWeapon,
} from "./combat/weapons/weaponFeelTuning.js";
export type { WeaponWeightTier, WeightFeelSpec } from "./combat/weapons/weaponFeelTuning.js";
export {
  WEAPON_ARCHETYPES, WEAPON_MOVESETS, getWeaponMoveset, getWeaponStepSpec, resolveWeaponArchetype, resolveWeaponAttackStep,
} from "./combat/weapons/weaponMovesets.js";
export type {
  AttackMotionKind, HarvestToolKind, WeaponArchetype, WeaponMovesetSpec, WeaponStepSpec,
} from "./combat/weapons/weaponMovesets.js";
export {
  HARVEST_NODE_SPECS, computeHarvestDamage, getHarvestNodeSpec, rollHarvestDrops,
} from "./survival/harvestRules.js";
export type { HarvestDropSpec, HarvestNodeSpec } from "./survival/harvestRules.js";
export {
  PALISADE_MAX_HP, STRUCTURE_KINDS, STRUCTURE_SPECS, canPlaceStructure,
  structureToChunkProp, structureToPointLight, validateStructurePlacement,
} from "./survival/campBuilding.js";
export type {
  PlacedStructureRecord, StructureKind, StructurePlacementReason, StructurePlacementValidation, StructureSpec,
} from "./survival/campBuilding.js";
export { SURVIVAL_BUFF_TUNING, applyWellFedDuration, computeSurvivalRegen } from "./survival/survivalBuffs.js";
export { WorldDeltaOverlay } from "./survival/worldDeltas.js";
export type { DepletedPropDelta, WorldDeltaSnapshot } from "./survival/worldDeltas.js";
export {
  ClientDismantleStructureSchema, ClientPlaceStructureSchema, ClientSetRespawnBedSchema,
  DepletedPropSchema, PlacedStructureSchema, WorldDeltaSnapshotSchema,
} from "./net/worldDeltaSchemas.js";
export * from "./world/fog/fogOfWar.js";
export * from "./world/pois/safeRoomLayout.js";
export * from "./inventory/stashOps.js";
export * from "./inventory/upgradeOps.js";
export * from "./net/hubSchemas.js";
export type { ArmorUpgradeMap } from "./inventory/slotModel.js";
export { NPC_KINDS } from "@dc2d/contracts";
export type { NpcKind } from "@dc2d/contracts";
