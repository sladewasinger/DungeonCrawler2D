/** Authoritative multiplayer WebSocket wire protocol schemas. */
import { z } from "zod";
import { CharacterAppearanceSchema } from "../character/appearance.js";
import { AI_STATES, ENTITY_KINDS } from "../combat/aiSensing.js";
import { ChatEntrySchema, ClientChatSchema, PlayerBubbleSchema, type ChatEntry, type PlayerBubble } from "./chatSchemas.js";
import { DiscoveryStateSchema, type DiscoveryStateSnapshot, type RevealedBeacon } from "./discoverySchemas.js";
import {
  ActiveBountyStateSchema, ActiveQuestStateSchema, ClientBlacksmithReforgeSchema, ClientBlacksmithUpgradeSchema,
  ClientBountyAcceptSchema, ClientBountyClaimSchema, ClientInteractNpcSchema, ClientMerchantBuySchema,
  ClientMerchantSellSchema, ClientQuestAcceptSchema, ClientQuestClaimSchema, ClientStashQuickMoveSchema,
  ClientStashTakeAllSchema, ClientStashTransferSchema, FogChunkDeltaSchema,
  type ActiveBountyState, type ActiveQuestState, type FogChunkDeltaSnapshot,
} from "./hubSchemas.js";
import {
  ArmorEquipmentSchema, ArmorPrefixesSchema, ArmorSlotKeySchema, ArmorUpgradesSchema,
  InventorySnapshotSchema, SlotItemSchema, type InventorySnapshot,
} from "./inventorySchemas.js";
import { ClientDropItemSchema, ClientPingSchema, ClientUseItemSchema, ServerPongSchema, type DropItemRequest } from "./sessionActionSchemas.js";
import {
  ClientDismantleStructureSchema, ClientPickupLootSchema, ClientPlaceStructureSchema,
  ClientSetRespawnBedSchema, WorldDeltaSnapshotSchema,
} from "./worldDeltaSchemas.js";
import { GoreStyleSchema, GoreSubstanceSchema, WorldEventSchema, type CreatureVocalKind, type WorldEvent } from "./worldEventSchemas.js";

export {
  ActiveBountyStateSchema, ActiveQuestStateSchema, ArmorEquipmentSchema, ArmorPrefixesSchema,
  ArmorSlotKeySchema, ArmorUpgradesSchema, ChatEntrySchema, ClientBlacksmithReforgeSchema,
  ClientBlacksmithUpgradeSchema, ClientBountyAcceptSchema, ClientBountyClaimSchema, ClientChatSchema,
  ClientDropItemSchema, ClientInteractNpcSchema, ClientMerchantBuySchema, ClientMerchantSellSchema,
  ClientPingSchema, ClientQuestAcceptSchema, ClientQuestClaimSchema, ClientStashQuickMoveSchema,
  ClientStashTakeAllSchema, ClientStashTransferSchema, ClientUseItemSchema, DiscoveryStateSchema,
  FogChunkDeltaSchema, GoreStyleSchema, GoreSubstanceSchema, InventorySnapshotSchema, PlayerBubbleSchema,
  ServerPongSchema, SlotItemSchema, WorldEventSchema,
};
export type {
  ActiveBountyState, ActiveQuestState, ChatEntry, CreatureVocalKind, DiscoveryStateSnapshot,
  DropItemRequest, FogChunkDeltaSnapshot, InventorySnapshot, PlayerBubble, RevealedBeacon, WorldEvent,
};

export const PROTOCOL_VERSION = 1;

const SlotIndexSchema = z.number().int().min(0).max(35);
const HotbarIndexSchema = z.number().int().min(0).max(8);
const SeqSchema = z.number().int().nonnegative().max(2_147_483_647).optional();

export const ClientHelloSchema = z.object({
  t: z.literal("hello"),
  version: z.literal(PROTOCOL_VERSION),
  name: z.string().min(1).max(24),
  appearance: CharacterAppearanceSchema.optional(),
  accountId: z.string().min(4).max(64).optional(),
  resumeToken: z.string().min(16).max(128).optional(),
});

export const ClientSetAppearanceSchema = z.object({
  t: z.literal("setAppearance"),
  name: z.string().min(1).max(24).optional(),
  appearance: CharacterAppearanceSchema,
  seq: SeqSchema,
});

export const ClientInputSchema = z.object({
  t: z.literal("input"),
  seq: z.number().int().nonnegative().max(2_147_483_647),
  moveX: z.number().min(-1).max(1),
  moveY: z.number().min(-1).max(1),
  aimX: z.number().min(-1).max(1).optional(),
  aimY: z.number().min(-1).max(1).optional(),
  jump: z.boolean().optional(),
  attack: z.boolean().optional(),
  attackHold: z.boolean().optional(),
  bowDraw: z.boolean().optional(),
  bowRelease: z.boolean().optional(),
  block: z.boolean().optional(),
  dodge: z.boolean().optional(),
  dodgeDirX: z.number().min(-1).max(1).optional(),
  dodgeDirY: z.number().min(-1).max(1).optional(),
  crouch: z.boolean().optional(),
  throwPebble: z.boolean().optional(),
  interact: z.boolean().optional(),
});

export const ClientRespawnSchema = z.object({ t: z.literal("respawn"), seq: SeqSchema });
export const ClientTorchToggleSchema = z.object({ t: z.literal("toggleTorch"), seq: SeqSchema });
export const ClientSetDayPhaseSchema = z.object({ t: z.literal("setDayPhase"), dayPhase: z.number().min(0).max(1), paused: z.boolean().optional(), seq: SeqSchema });
export const ClientMoveSlotSchema = z.object({ t: z.literal("moveSlot"), from: SlotIndexSchema, to: SlotIndexSchema, seq: SeqSchema });
export const ClientEquipArmorSchema = z.object({ t: z.literal("equipArmor"), slotIndex: SlotIndexSchema, targetArmor: ArmorSlotKeySchema.optional(), seq: SeqSchema });
export const ClientUnequipArmorSchema = z.object({ t: z.literal("unequipArmor"), armorSlot: ArmorSlotKeySchema, targetSlot: SlotIndexSchema.optional(), seq: SeqSchema });
export const ClientSelectHotbarSchema = z.object({ t: z.literal("selectHotbar"), slot: HotbarIndexSchema, seq: SeqSchema });
export const ClientCraftSchema = z.object({ t: z.literal("craft"), recipeId: z.string().min(1).max(48), seq: SeqSchema });
export const ClientOpenChestSchema = z.object({ t: z.literal("openChest"), chestId: z.string().min(1).max(64), seq: SeqSchema });
export const ClientChestTransferSchema = z.object({
  t: z.literal("chestTransfer"),
  chestId: z.string().min(1).max(64),
  from: z.enum(["chest", "inv"]),
  fromSlot: SlotIndexSchema,
  to: z.enum(["chest", "inv"]),
  toSlot: SlotIndexSchema,
  quick: z.boolean().optional(),
  seq: SeqSchema,
});
export const ClientChestTakeAllSchema = z.object({ t: z.literal("chestTakeAll"), chestId: z.string().min(1).max(64), seq: SeqSchema });
export const ClientDebugSpawnSchema = z.object({ t: z.literal("debugSpawn"), kind: z.enum(ENTITY_KINDS), count: z.number().int().min(1).max(10).optional(), seq: SeqSchema });
export const ClientAdminSchema = z.object({
  t: z.literal("admin"), action: z.enum(["auth", "godMode", "heal", "give", "giveGold", "clearWebs", "teleport"]),
  enabled: z.boolean().optional(), itemId: z.string().min(1).max(48).optional(),
  count: z.number().int().min(1).max(100_000).optional(), token: z.string().min(1).max(256).optional(),
  x: z.number().finite().min(-1_000_000).max(1_000_000).optional(),
  y: z.number().finite().min(-1_000_000).max(1_000_000).optional(),
  seq: SeqSchema,
});

export const ClientMessageSchema = z.discriminatedUnion("t", [
  ClientHelloSchema, ClientSetAppearanceSchema, ClientInputSchema, ClientRespawnSchema, ClientTorchToggleSchema,
  ClientSetDayPhaseSchema, ClientMoveSlotSchema, ClientEquipArmorSchema, ClientUnequipArmorSchema,
  ClientSelectHotbarSchema, ClientCraftSchema, ClientOpenChestSchema, ClientChestTransferSchema,
  ClientChestTakeAllSchema, ClientDebugSpawnSchema, ClientAdminSchema, ClientPlaceStructureSchema,
  ClientDismantleStructureSchema, ClientSetRespawnBedSchema, ClientPickupLootSchema, ClientDropItemSchema,
  ClientUseItemSchema, ClientChatSchema, ClientPingSchema,
  ClientInteractNpcSchema, ClientMerchantBuySchema, ClientMerchantSellSchema,
  ClientBlacksmithReforgeSchema, ClientBlacksmithUpgradeSchema, ClientBountyAcceptSchema,
  ClientBountyClaimSchema, ClientQuestAcceptSchema, ClientQuestClaimSchema,
  ClientStashTransferSchema, ClientStashQuickMoveSchema, ClientStashTakeAllSchema,
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export const PlayerSnapshotSchema = z.object({
  id: z.string(), name: z.string(), x: z.number(), y: z.number(), elevation: z.number(),
  facingX: z.number(), facingY: z.number(), aimX: z.number().optional(), aimY: z.number().optional(),
  jumpZ: z.number().optional(), jumpVz: z.number().optional(), moving: z.boolean(),
  sprinting: z.boolean().optional(), torchLit: z.boolean(), inWater: z.boolean(),
  inDeepWater: z.boolean().optional(), lastAckSeq: z.number().int(),
  heldItem: z.string().nullable().optional(), appearance: CharacterAppearanceSchema.optional(),
  armor: ArmorEquipmentSchema.optional(), hp: z.number().optional(), maxHp: z.number().optional(),
  stamina: z.number().optional(), maxStamina: z.number().optional(), comboStep: z.number().int().optional(),
  swingProgress: z.number().optional(), heavyCharge: z.number().optional(), bowCharge: z.number().optional(),
  blocking: z.boolean().optional(), dodging: z.boolean().optional(), invulnTimer: z.number().optional(),
  staggerTimer: z.number().optional(), bleedTimer: z.number().optional(), burnTimer: z.number().optional(),
  poisonTimer: z.number().optional(), poisonLocked: z.boolean().optional(), webSlowTimer: z.number().optional(),
  webStick: z.number().optional(), cocoonProgress: z.number().optional(), hitTimer: z.number().optional(),
  respawnTimer: z.number().optional(), inSanctuary: z.boolean().optional(), crouching: z.boolean().optional(),
  stealthVis: z.number().optional(), inCover: z.boolean().optional(), attackFlash: z.boolean().optional(),
  wellFedTimer: z.number().optional(), invigoratedTimer: z.number().optional(), restedTimer: z.number().optional(),
  hotTimer: z.number().optional(), hearthWarmProgress: z.number().min(0).max(1).optional(),
  hasBedRespawn: z.boolean().optional(), respawnBedPos: z.object({ x: z.number(), y: z.number() }).optional(),
  godMode: z.boolean().optional(), activeBubble: PlayerBubbleSchema.optional(), moveSpeedMult: z.number().optional(),
  glowRadiusBonus: z.number().optional(), shrineBuff: z.object({ kind: z.string(), remainingSec: z.number() }).optional(),
  gold: z.number().int().nonnegative().optional(),
});

export type PlayerSnapshot = z.infer<typeof PlayerSnapshotSchema>;

export const ProjectileSnapshotSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  kind: z.enum(["arrow", "pebble", "web"]),
  x: z.number(),
  y: z.number(),
  z: z.number().optional(),
  vx: z.number(),
  vy: z.number(),
  elevation: z.number(),
  charge: z.number(),
  element: z.enum(["none", "fire", "frost", "poison"]).optional(),
});

export type ProjectileSnapshot = z.infer<typeof ProjectileSnapshotSchema>;

export const WorldEntitySnapshotSchema = z.object({
  id: z.string(),
  kind: z.enum(ENTITY_KINDS),
  substance: GoreSubstanceSchema,
  x: z.number(),
  y: z.number(),
  elevation: z.number(),
  jumpZ: z.number().optional(),
  facingX: z.number(),
  facingY: z.number(),
  hp: z.number(),
  maxHp: z.number(),
  hitTimer: z.number(),
  staggerTimer: z.number(),
  bleedTimer: z.number(),
  telegraphProgress: z.number(),
  attackProgress: z.number().optional(),
  aiState: z.enum(AI_STATES).optional(),
  suspicion: z.number().optional(),
  stunned: z.boolean().optional(),
  howling: z.boolean().optional(),
  bluffing: z.boolean().optional(),
  spottedPop: z.boolean().optional(),
  sniffing: z.boolean().optional(),
  burning: z.boolean().optional(),
  parried: z.boolean().optional(),
  corpse: z.boolean().optional(),
  inWater: z.boolean().optional(),
  inDeepWater: z.boolean().optional(),
  isElite: z.boolean().optional(),
  title: z.string().max(40).optional(),
  dangerTier: z.number().int().min(1).max(5).optional(),
});

export type WorldEntitySnapshot = z.infer<typeof WorldEntitySnapshotSchema>;

export const WorldChestSnapshotSchema = z.object({
  id: z.string(),
  poiKind: z.string().min(1),
  x: z.number(),
  y: z.number(),
  elevation: z.number(),
  opened: z.boolean(),
  sealed: z.boolean().optional(),
  braziersLit: z.number().int().nonnegative().optional(),
  braziersTotal: z.number().int().nonnegative().optional(),
  slots: z.array(SlotItemSchema.nullable()).length(27),
});

export type WorldChestSnapshot = z.infer<typeof WorldChestSnapshotSchema>;

export const GroundLootSnapshotSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  count: z.number().int().min(1),
  prefixId: z.string().min(1).max(32).optional(),
  x: z.number(),
  y: z.number(),
  elevation: z.number(),
  ageSec: z.number(),
  manualPickup: z.boolean().optional(),
  angle: z.number().optional(),
  stuck: z.boolean().optional(),
});

export type GroundLootSnapshot = z.infer<typeof GroundLootSnapshotSchema>;

export const ServerWelcomeSchema = z.object({
  t: z.literal("welcome"), playerId: z.string(), worldSeed: z.number().int(),
  dayPhase: z.number(), dayPaused: z.boolean(), tickRate: z.number(),
  accountId: z.string().optional(), resumeToken: z.string().optional(),
});

const WebNodeSnapshotSchema = z.object({ id: z.number().int(), x: z.number(), y: z.number(), pinned: z.boolean(), fire: z.number().optional() });
const WebStrandSnapshotSchema = z.object({ a: z.number().int(), b: z.number().int(), fire: z.number().optional() });
export const WorldWebSnapshotSchema = z.object({ nodes: z.array(WebNodeSnapshotSchema), strands: z.array(WebStrandSnapshotSchema) });
export type WorldWebSnapshot = z.infer<typeof WorldWebSnapshotSchema>;

export const ServerSnapshotSchema = z.object({
  t: z.literal("snapshot"),
  tick: z.number().int().nonnegative(),
  dayPhase: z.number(),
  dayPaused: z.boolean(),
  actionAckSeq: SeqSchema,
  players: z.array(PlayerSnapshotSchema),
  selfInventory: InventorySnapshotSchema.optional(),
  selfAdmin: z.boolean().optional(),
  projectiles: z.array(ProjectileSnapshotSchema).optional(),
  entities: z.array(WorldEntitySnapshotSchema).optional(),
  chests: z.array(WorldChestSnapshotSchema).optional(),
  groundLoot: z.array(GroundLootSnapshotSchema).optional(),
  webs: WorldWebSnapshotSchema.optional(),
  events: z.array(WorldEventSchema).optional(),
  chatMessages: z.array(ChatEntrySchema).optional(),
  worldDeltas: WorldDeltaSnapshotSchema.optional(),
  selfDiscovery: DiscoveryStateSchema.optional(),
  selfStash: z.array(SlotItemSchema.nullable()).length(27).optional(),
  selfBounties: z.array(ActiveBountyStateSchema).optional(),
  selfQuests: z.array(ActiveQuestStateSchema).optional(),
  selfFogDelta: z.array(FogChunkDeltaSchema).optional(),
});

export const ServerMessageSchema = z.discriminatedUnion("t", [ServerWelcomeSchema, ServerSnapshotSchema, ServerPongSchema]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;
