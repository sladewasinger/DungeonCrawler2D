// Item defs — consumables, throwables, and weapons; the crafting output/input vocabulary.
import { z } from "zod";
import { primitiveSchema } from "./primitives.js";

export const itemDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  tags: z.array(z.string()),
  maxStack: z.number().int().min(1).max(99),
  consumable: z
    .object({
      /** Applied to the consumer. */
      effects: z.array(primitiveSchema),
    })
    .optional(),
  throwable: z
    .object({
      /** Applied at the impact tile / direct-hit entity. */
      onImpact: z.array(primitiveSchema),
      /** Chance the item is destroyed on impact (else drops). */
      breakChance: z.number().min(0).max(1),
    })
    .optional(),
  weapon: z
    .object({
      damage: z.number().positive(),
      /** Statuses applied to melee victims. */
      applies: z.array(z.object({ status: z.string(), chance: z.number().min(0).max(1) })).optional(),
    })
    .optional(),
});
export type ItemDef = z.infer<typeof itemDefSchema>;
