/** Zod wire schemas for player inventory slots, equipment, prefixes, and upgrade levels. */
import { ARMOR_SLOT_KEYS } from "@dc2d/contracts";
import { z } from "zod";
import { TOTAL_INVENTORY_SLOTS } from "../inventory/slotModel.js";

const HotbarIndexSchema = z.number().int().min(0).max(8);
const SeqSchema = z.number().int().nonnegative().max(2_147_483_647).optional();

export const ArmorSlotKeySchema = z.enum(ARMOR_SLOT_KEYS);
export const SlotItemSchema = z.object({
  itemId: z.string().min(1),
  count: z.number().int().min(1),
  prefixId: z.string().min(1).max(32).optional(),
  upgradeLevel: z.number().int().min(1).max(3).optional(),
});

export const ArmorEquipmentSchema = z.object({
  head: z.string().nullable(),
  chest: z.string().nullable(),
  legs: z.string().nullable(),
  feet: z.string().nullable(),
  offhand: z.string().nullable().default(null),
});

export const ArmorPrefixesSchema = z.object({
  head: z.string(),
  chest: z.string(),
  legs: z.string(),
  feet: z.string(),
  offhand: z.string(),
}).partial();

export const ArmorUpgradesSchema = z.object({
  head: z.number().int().min(1).max(3),
  chest: z.number().int().min(1).max(3),
  legs: z.number().int().min(1).max(3),
  feet: z.number().int().min(1).max(3),
  offhand: z.number().int().min(1).max(3),
}).partial();

export const InventorySnapshotSchema = z.object({
  slots: z.array(SlotItemSchema.nullable()).length(TOTAL_INVENTORY_SLOTS),
  armor: ArmorEquipmentSchema,
  armorPrefixes: ArmorPrefixesSchema.optional(),
  armorUpgrades: ArmorUpgradesSchema.optional(),
  gold: z.number().int().nonnegative().optional(),
  selectedHotbar: HotbarIndexSchema,
  nearCampfire: z.boolean(),
  nearWorkbench: z.boolean(),
  ackSeq: SeqSchema,
});

export type InventorySnapshot = z.infer<typeof InventorySnapshotSchema>;
