/** Authoritative multiplayer WebSocket wire protocol schemas. */
import { z } from "zod";
import { CharacterAppearanceSchema } from "../character/appearance.js";
import { AI_STATES, ENTITY_KINDS } from "../combat/aiSensing.js";
import { ChatEntrySchema, ClientChatSchema, PlayerBubbleSchema, type ChatEntry, type PlayerBubble } from "./chatSchemas.js";
import { ClientDropItemSchema, ClientPingSchema, ClientUseItemSchema, ServerPongSchema, type DropItemRequest } from "./sessionActionSchemas.js";
import { ClientPickupLootSchema, ClientPlaceStructureSchema, ClientSetRespawnBedSchema, WorldDeltaSnapshotSchema } from "./worldDeltaSchemas.js";
import { GoreStyleSchema, GoreSubstanceSchema, WorldEventSchema, type CreatureVocalKind, type WorldEvent } from "./worldEventSchemas.js";

export {
  ChatEntrySchema, ClientChatSchema, ClientDropItemSchema, ClientPingSchema, ClientUseItemSchema,
  GoreStyleSchema, GoreSubstanceSchema, PlayerBubbleSchema, ServerPongSchema, WorldEventSchema,
};
export type { ChatEntry, CreatureVocalKind, DropItemRequest, PlayerBubble, WorldEvent };

export const PROTOCOL_VERSION = 1;

const SlotIndexSchema = z.number().int().min(0).max(35);
const HotbarIndexSchema = z.number().int().min(0).max(8);
const SeqSchema = z.number().int().nonnegative().optional();

export const ArmorSlotKeySchema = z.enum(["head", "chest", "legs", "feet", "offhand"]);
export const SlotItemSchema = z.object({
  itemId: z.string().min(1),
  count: z.number().int().min(1),
  prefixId: z.string().min(1).max(32).optional(),
});

export const ArmorEquipmentSchema = z.object({
  head: z.string().nullable(), chest: z.string().nullable(), legs: z.string().nullable(),
  feet: z.string().nullable(), offhand: z.string().nullable().default(null),
});

export const ArmorPrefixesSchema = z.object({
  head: z.string(), chest: z.string(), legs: z.string(), feet: z.string(), offhand: z.string(),
}).partial();

export const InventorySnapshotSchema = z.object({
  slots: z.array(SlotItemSchema.nullable()).length(36),
  armor: ArmorEquipmentSchema,
  armorPrefixes: ArmorPrefixesSchema.optional(),
  selectedHotbar: HotbarIndexSchema,
  nearCampfire: z.boolean(),
  ackSeq: SeqSchema,
});

export type InventorySnapshot = z.infer<typeof InventorySnapshotSchema>;

export const ClientHelloSchema = z.object({
  t: z.literal("hello"),
  version: z.literal(PROTOCOL_VERSION),
  name: z.string().min(1).max(24),
  appearance: CharacterAppearanceSchema.optional(),
});

export const ClientSetAppearanceSchema = z.object({
  t: z.literal("setAppearance"),
  name: z.string().min(1).max(24).optional(),
  appearance: CharacterAppearanceSchema,
  seq: SeqSchema,
});

export const ClientInputSchema = z.object({
  t: z.literal("input"),
  seq: z.number().int().nonnegative(),
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
  t: z.literal("admin"), action: z.enum(["auth", "godMode", "heal", "give", "clearWebs"]),
  enabled: z.boolean().optional(), itemId: z.string().min(1).max(48).optional(),
  count: z.number().int().min(1).max(99).optional(), token: z.string().min(1).max(256).optional(), seq: SeqSchema,
});

export const ClientMessageSchema = z.discriminatedUnion("t", [
  ClientHelloSchema, ClientSetAppearanceSchema, ClientInputSchema, ClientRespawnSchema, ClientTorchToggleSchema,
  ClientSetDayPhaseSchema, ClientMoveSlotSchema, ClientEquipArmorSchema, ClientUnequipArmorSchema,
  ClientSelectHotbarSchema, ClientCraftSchema, ClientOpenChestSchema, ClientChestTransferSchema,
  ClientChestTakeAllSchema, ClientDebugSpawnSchema, ClientAdminSchema, ClientPlaceStructureSchema, ClientSetRespawnBedSchema,
  ClientPickupLootSchema, ClientDropItemSchema, ClientUseItemSchema, ClientChatSchema, ClientPingSchema,
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
  wellFedTimer: z.number().optional(), restedTimer: z.number().optional(),
  hasBedRespawn: z.boolean().optional(), godMode: z.boolean().optional(),
  activeBubble: PlayerBubbleSchema.optional(), moveSpeedMult: z.number().optional(),
  glowRadiusBonus: z.number().optional(), shrineBuff: z.object({ kind: z.string(), remainingSec: z.number() }).optional(),
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
});

export type WorldEntitySnapshot = z.infer<typeof WorldEntitySnapshotSchema>;

export const WorldChestSnapshotSchema = z.object({
  id: z.string(),
  poiKind: z.enum(["bandit-camp", "ancient-ruins", "player-chest"]),
  x: z.number(),
  y: z.number(),
  elevation: z.number(),
  opened: z.boolean(),
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
});

export const WebNodeSnapshotSchema = z.object({ id: z.number().int(), x: z.number(), y: z.number(), pinned: z.boolean(), fire: z.number().optional() });
export type WebNodeSnapshot = z.infer<typeof WebNodeSnapshotSchema>;

export const WebStrandSnapshotSchema = z.object({ a: z.number().int(), b: z.number().int(), fire: z.number().optional() });
export type WebStrandSnapshot = z.infer<typeof WebStrandSnapshotSchema>;

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
});

export const ServerMessageSchema = z.discriminatedUnion("t", [ServerWelcomeSchema, ServerSnapshotSchema, ServerPongSchema]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;
