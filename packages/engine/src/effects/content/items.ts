// Item defs — consumables, throwables, weapons, and armor; the crafting output/input vocabulary.
import { z } from "zod";
import { primitiveSchema } from "../primitives.js";
import { attackProfileInputSchema } from "../../combat/weapons/weaponProfiles.js";

export const ARMOR_SLOTS = ["head", "chest", "legs", "boots"] as const;
export const armorSlotSchema = z.enum(ARMOR_SLOTS);
export type ArmorSlot = z.infer<typeof armorSlotSchema>;

export const armorLoadoutSchema = z.object({
  head: z.string().nullable(),
  chest: z.string().nullable(),
  legs: z.string().nullable(),
  boots: z.string().nullable(),
});
export type ArmorLoadout = z.infer<typeof armorLoadoutSchema>;

export function emptyArmorLoadout(): ArmorLoadout {
  return { head: null, chest: null, legs: null, boots: null };
}

export const itemArmorSchema = z.object({
  slot: armorSlotSchema,
  damageReduction: z.number().min(0).max(0.8),
  maxHpBonus: z.number().nonnegative().optional(),
  moveSpeedBonus: z.number().nonnegative().optional(),
});
export type ItemArmorDef = z.infer<typeof itemArmorSchema>;

export const itemRangedSchema = z.object({
  ammoItem: z.string(),
  minDamage: z.number().positive(),
  maxDamage: z.number().positive(),
  minSpeed: z.number().positive(),
  maxSpeed: z.number().positive(),
  maxRange: z.number().positive(),
  maxDrawMs: z.number().int().positive(),
  cooldownMs: z.number().int().positive(),
});
export type ItemRangedDef = z.infer<typeof itemRangedSchema>;

export const itemDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  tags: z.array(z.string()),
  maxStack: z.number().int().min(1).max(99),
  flavor: z.string().optional(),
  consumable: z
    .object({
      /** Applied to the consumer. */
      effects: z.array(primitiveSchema),
    })
    .optional(),
  throwable: z
    .object({
      /** Applied at impact for ordinary throwables; placed entities use their landing rule. */
      onImpact: z.array(primitiveSchema),
      /** Chance the item is destroyed on impact (else drops). */
      breakChance: z.number().min(0).max(1),
      placesEntity: z.enum(["torch"]).optional(),
    })
    .optional(),
  weapon: attackProfileInputSchema.extend({
      /** Statuses applied to melee victims. */
      applies: z.array(z.object({ status: z.string(), chance: z.number().min(0).max(1) })).optional(),
    })
    .optional(),
  ranged: itemRangedSchema.optional(),
  armor: itemArmorSchema.optional(),
});
export type ItemDef = z.infer<typeof itemDefSchema>;
