/** Authoritative multiplayer WebSocket wire protocol schemas. */
import { z } from "zod";
import { CharacterAppearanceSchema } from "../character/appearance.js";

export const PROTOCOL_VERSION = 1;

const SlotIndexSchema = z.number().int().min(0).max(35);
const HotbarIndexSchema = z.number().int().min(0).max(8);
const SeqSchema = z.number().int().nonnegative().optional();

export const ArmorSlotKeySchema = z.enum(["head", "chest", "legs", "feet"]);
export const SlotItemSchema = z.object({ itemId: z.string().min(1), count: z.number().int().min(1) });

export const ArmorEquipmentSchema = z.object({
  head: z.string().nullable(),
  chest: z.string().nullable(),
  legs: z.string().nullable(),
  feet: z.string().nullable(),
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
  moving: z.boolean(),
  torchLit: z.boolean(),
  inWater: z.boolean(),
  lastAckSeq: z.number().int(),
  heldItem: z.string().nullable().optional(),
  appearance: CharacterAppearanceSchema.optional(),
  armor: ArmorEquipmentSchema.optional(),
});

export type PlayerSnapshot = z.infer<typeof PlayerSnapshotSchema>;

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
});

export const ServerMessageSchema = z.discriminatedUnion("t", [
  ServerWelcomeSchema,
  ServerSnapshotSchema,
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;
