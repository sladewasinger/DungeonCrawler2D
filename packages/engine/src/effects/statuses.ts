// Status defs and the cross-tag interaction rules that fire between them.
import { z } from "zod";
import { primitiveSchema } from "./primitives.js";

export const statusDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["buff", "debuff"]),
  tags: z.array(z.string()),
  /** Seconds; null = until removed. */
  duration: z.number().positive().nullable(),
  /** Seconds between onTick firings (requires onTick). */
  tickEvery: z.number().positive().optional(),
  stacking: z.enum(["refresh", "stack", "ignore"]),
  maxStacks: z.number().int().min(1).max(10).optional(),
  /** Tags the bearer gains while this status is active. */
  appliesTags: z.array(z.string()).optional(),
  onApply: z.array(primitiveSchema).optional(),
  onTick: z.array(primitiveSchema).optional(),
  onExpire: z.array(primitiveSchema).optional(),
  /** Continuous modifiers evaluated while active (modify_stat only). */
  whileActive: z.array(primitiveSchema).optional(),
});
export type StatusDef = z.infer<typeof statusDefSchema>;

export const interactionRuleSchema = z.object({
  /** Fires when an entity carries both tags at once. */
  when: z.tuple([z.string(), z.string()]),
  /** Strip active statuses carrying any of these tags. */
  removeTags: z.array(z.string()).optional(),
  /** Apply this status. */
  apply: z.string().optional(),
});
export type InteractionRule = z.infer<typeof interactionRuleSchema>;
