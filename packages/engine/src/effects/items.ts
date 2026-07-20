// Item defs — consumables, throwables, and weapons; the crafting output/input vocabulary.
import { z } from "zod";
import { primitiveSchema } from "./primitives.js";

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
      /** Applied at the impact tile / direct-hit entity. */
      onImpact: z.array(primitiveSchema),
      /** Chance the item is destroyed on impact (else drops). */
      breakChance: z.number().min(0).max(1),
      /**
       * Data-first alternative landing behavior: a dedicated throw
       * intent (e.g. `throwTorch`) plants a persistent, replicated
       * world entity of this kind instead of running onImpact/
       * breakChance — not a torch-only code special case. Item-generic
       * target-tile throws (`useSlot`) are unaffected by this field.
       */
      placesEntity: z.enum(["torch"]).optional(),
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
