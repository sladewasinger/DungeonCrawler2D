import { z } from "zod";

const safeId = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const knownTag = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const sourceSchema = z.object({
  sourceFromTag: knownTag.optional(),
});

export const areaReactionActionSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("remove"), tag: knownTag }).strict(),
  sourceSchema.extend({
    op: z.literal("add"),
    area: safeId,
  }).strict(),
  sourceSchema.extend({
    op: z.literal("transform"),
    tag: knownTag,
    area: safeId,
  }).strict(),
  z.object({
    op: z.literal("rate_consume"),
    tag: knownTag,
    perSecond: z.number().positive().max(100),
  }).strict(),
]);

export const areaReactionSchema = z.object({
  id: safeId,
  priority: z.number().int().min(-100).max(100),
  when: z.tuple([knownTag, knownTag]),
  actions: z.array(areaReactionActionSchema).min(1).max(4),
}).strict();

export type AreaReactionAction = z.infer<typeof areaReactionActionSchema>;
export type AreaReaction = z.infer<typeof areaReactionSchema>;
