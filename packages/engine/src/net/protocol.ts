/** Authoritative multiplayer WebSocket wire protocol schemas. */
import { z } from "zod";
import { CharacterAppearanceSchema } from "../character/appearance.js";
import { AI_STATES, ENTITY_KINDS } from "../combat/aiSensing.js";
import { GORE_STYLES, GORE_SUBSTANCES } from "../combat/combatRules.js";

export const PROTOCOL_VERSION = 1;

const SlotIndexSchema = z.number().int().min(0).max(35);
const HotbarIndexSchema = z.number().int().min(0).max(8);
const SeqSchema = z.number().int().nonnegative().optional();

export const ArmorSlotKeySchema = z.enum(["head", "chest", "legs", "feet", "offhand"]);
export const SlotItemSchema = z.object({ itemId: z.string().min(1), count: z.number().int().min(1) });
export const GoreSubstanceSchema = z.enum(GORE_SUBSTANCES);
export const GoreStyleSchema = z.enum(GORE_STYLES);

export const ArmorEquipmentSchema = z.object({
  head: z.string().nullable(),
  chest: z.string().nullable(),
  legs: z.string().nullable(),
  feet: z.string().nullable(),
  offhand: z.string().nullable().default(null),
});

export const InventorySnapshotSchema = z.object({
  slots: z.array(SlotItemSchema.nullable()).length(36),
  armor: ArmorEquipmentSchema,
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
  bowDraw: z.boolean().optional(),
  bowRelease: z.boolean().optional(),
  block: z.boolean().optional(),
  dodge: z.boolean().optional(),
  interact: z.boolean().optional(),
});

export const ClientTorchToggleSchema = z.object({ t: z.literal("toggleTorch"), seq: SeqSchema });
export const ClientSetDayPhaseSchema = z.object({ t: z.literal("setDayPhase"), dayPhase: z.number().min(0).max(1), paused: z.boolean().optional(), seq: SeqSchema });
export const ClientMoveSlotSchema = z.object({ t: z.literal("moveSlot"), from: SlotIndexSchema, to: SlotIndexSchema, seq: SeqSchema });
export const ClientEquipArmorSchema = z.object({ t: z.literal("equipArmor"), slotIndex: SlotIndexSchema, targetArmor: ArmorSlotKeySchema.optional(), seq: SeqSchema });
export const ClientUnequipArmorSchema = z.object({ t: z.literal("unequipArmor"), armorSlot: ArmorSlotKeySchema, targetSlot: SlotIndexSchema.optional(), seq: SeqSchema });
export const ClientSelectHotbarSchema = z.object({ t: z.literal("selectHotbar"), slot: HotbarIndexSchema, seq: SeqSchema });
export const ClientCraftSchema = z.object({ t: z.literal("craft"), recipeId: z.string().min(1).max(48), seq: SeqSchema });

export const ClientMessageSchema = z.discriminatedUnion("t", [
  ClientHelloSchema,
  ClientSetAppearanceSchema,
  ClientInputSchema,
  ClientTorchToggleSchema,
  ClientSetDayPhaseSchema,
  ClientMoveSlotSchema,
  ClientEquipArmorSchema,
  ClientUnequipArmorSchema,
  ClientSelectHotbarSchema,
  ClientCraftSchema,
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export const PlayerSnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  x: z.number(),
  y: z.number(),
  elevation: z.number(),
  facingX: z.number(),
  facingY: z.number(),
  aimX: z.number().optional(),
  aimY: z.number().optional(),
  jumpZ: z.number().optional(),
  jumpVz: z.number().optional(),
  moving: z.boolean(),
  torchLit: z.boolean(),
  inWater: z.boolean(),
  lastAckSeq: z.number().int(),
  heldItem: z.string().nullable().optional(),
  appearance: CharacterAppearanceSchema.optional(),
  armor: ArmorEquipmentSchema.optional(),
  hp: z.number().optional(),
  maxHp: z.number().optional(),
  stamina: z.number().optional(),
  maxStamina: z.number().optional(),
  comboStep: z.number().int().optional(),
  swingProgress: z.number().optional(),
  bowCharge: z.number().optional(),
  blocking: z.boolean().optional(),
  dodging: z.boolean().optional(),
  staggerTimer: z.number().optional(),
  bleedTimer: z.number().optional(),
  inSanctuary: z.boolean().optional(),
});

export type PlayerSnapshot = z.infer<typeof PlayerSnapshotSchema>;

export const ProjectileSnapshotSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  kind: z.literal("arrow"),
  x: z.number(),
  y: z.number(),
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
  facingX: z.number(),
  facingY: z.number(),
  hp: z.number(),
  maxHp: z.number(),
  hitTimer: z.number(),
  staggerTimer: z.number(),
  bleedTimer: z.number(),
  telegraphProgress: z.number(),
  aiState: z.enum(AI_STATES).optional(),
  corpse: z.boolean().optional(),
});

export type WorldEntitySnapshot = z.infer<typeof WorldEntitySnapshotSchema>;

export const WorldChestSnapshotSchema = z.object({
  id: z.string(),
  poiKind: z.enum(["bandit-camp", "ancient-ruins"]),
  x: z.number(),
  y: z.number(),
  elevation: z.number(),
  opened: z.boolean(),
});

export type WorldChestSnapshot = z.infer<typeof WorldChestSnapshotSchema>;

export const GroundLootSnapshotSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  count: z.number().int().min(1),
  x: z.number(),
  y: z.number(),
  elevation: z.number(),
  ageSec: z.number(),
});

export type GroundLootSnapshot = z.infer<typeof GroundLootSnapshotSchema>;

export const WorldEventSchema = z.object({
  kind: z.enum(["swing", "hit", "block", "parry", "arrowFire", "dodge", "heal", "respawn", "telegraph", "chestOpen", "loot"]),
  x: z.number(),
  y: z.number(),
  dirX: z.number().optional(),
  dirY: z.number().optional(),
  value: z.number().optional(),
  actorId: z.string().optional(),
  targetId: z.string().optional(),
  comboStep: z.number().int().optional(),
  goreStyle: GoreStyleSchema.optional(),
  substance: GoreSubstanceSchema.optional(),
  fatal: z.boolean().optional(),
});

export type WorldEvent = z.infer<typeof WorldEventSchema>;

export const ServerWelcomeSchema = z.object({
  t: z.literal("welcome"),
  playerId: z.string(),
  worldSeed: z.number().int(),
  dayPhase: z.number(),
  dayPaused: z.boolean(),
  tickRate: z.number(),
});

export const ServerSnapshotSchema = z.object({
  t: z.literal("snapshot"),
  tick: z.number().int().nonnegative(),
  dayPhase: z.number(),
  dayPaused: z.boolean(),
  actionAckSeq: SeqSchema,
  players: z.array(PlayerSnapshotSchema),
  selfInventory: InventorySnapshotSchema.optional(),
  projectiles: z.array(ProjectileSnapshotSchema).optional(),
  entities: z.array(WorldEntitySnapshotSchema).optional(),
  chests: z.array(WorldChestSnapshotSchema).optional(),
  groundLoot: z.array(GroundLootSnapshotSchema).optional(),
  events: z.array(WorldEventSchema).optional(),
});

export const ServerMessageSchema = z.discriminatedUnion("t", [
  ServerWelcomeSchema,
  ServerSnapshotSchema,
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;
