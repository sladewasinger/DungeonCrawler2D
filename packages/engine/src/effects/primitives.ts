// Effect primitives — the closed vocabulary content and the AI crafting pipeline compose from.
import { z } from "zod";

export const primitiveSchema = z.discriminatedUnion("primitive", [
  z.object({
    primitive: z.literal("modify_health"),
    /** Positive heals, negative damages. Applied once per firing. */
    amount: z.number(),
  }),
  z.object({
    primitive: z.literal("modify_stat"),
    stat: z.enum(["speed"]),
    /** Multiplier while the owning status is active. */
    mult: z.number().positive().max(5),
  }),
  z.object({
    primitive: z.literal("apply_status"),
    status: z.string(),
    chance: z.number().min(0).max(1).optional(),
  }),
  z.object({
    primitive: z.literal("remove_status"),
    /** Removes active statuses carrying this tag. */
    tag: z.string(),
  }),
  z.object({
    primitive: z.literal("spawn_area"),
    area: z.string(),
    radius: z.number().int().min(0).max(4),
  }),
  z.object({ primitive: z.literal("destroy_entity") }),
]);
export type Primitive = z.infer<typeof primitiveSchema>;
