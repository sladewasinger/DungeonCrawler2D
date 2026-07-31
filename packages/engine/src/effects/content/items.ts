// Item defs — consumables, throwables, and weapons; the crafting output/input vocabulary.
import { z } from "zod";
import { primitiveSchema } from "../primitives.js";
import { attackProfileInputSchema } from "../../combat/weapons/weaponProfiles.js";

export const itemDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  tags: z.array(z.string()),
  maxStack: z.number().int().min(1).max(99),
  /**
   * DCC-book flavor text (Epic 7.13, book-fan lane — ASSUMPTION #100,
   * docs/ASSUMPTIONS.md). Optional so every hand-built ItemDef fixture
   * elsewhere in the repo keeps compiling unchanged. Not rendered
   * anywhere server-side yet: display in the client inventory is
   * deferred to a future wave that owns that lane.
   */
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
      /**
       * Data-first landing behavior: the shared target-tile throw plants
       * a persistent replicated entity of this kind and bypasses generic
       * onImpact/breakChance handling. The entity lifecycle may outlive VFX.
       */
      placesEntity: z.enum(["torch"]).optional(),
    })
    .optional(),
  weapon: attackProfileInputSchema.extend({
      /** Statuses applied to melee victims. */
      applies: z.array(z.object({ status: z.string(), chance: z.number().min(0).max(1) })).optional(),
    })
    .optional(),
});
export type ItemDef = z.infer<typeof itemDefSchema>;
