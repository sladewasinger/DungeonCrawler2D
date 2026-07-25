import { z } from "zod";

export const gameEventSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("hit"), id: z.string(), amount: z.number() }),
  z.object({
    t: z.literal("health"),
    id: z.string(),
    delta: z.number(),
    kind: z.enum(["heal", "damage"]),
  }),
  z.object({ t: z.literal("death"), id: z.string() }),
  z.object({ t: z.literal("status"), id: z.string(), status: z.string(), on: z.boolean() }),
  z.object({
    t: z.literal("chat"),
    channel: z.enum(["party", "local", "global", "dm", "system"]),
    from: z.string(),
    name: z.string(),
    text: z.string(),
    /** The other party's display name for rendering DM threads and resolving /r. */
    target: z.string().optional(),
  }),
  z.object({ t: z.literal("toast"), msg: z.string() }),
  z.object({ t: z.literal("invite"), from: z.string(), name: z.string() }),
  z.object({
    t: z.literal("moderationUpdated"),
    muted: z.array(z.string()),
    blocked: z.array(z.string()),
  }),
  z.object({ t: z.literal("teleported") }),
  z.object({
    t: z.literal("stash"),
    slots: z.array(z.object({ item: z.string(), qty: z.number().int() })),
  }),
  z.object({
    t: z.literal("contactsUpdated"),
    contacts: z.array(z.object({
      name: z.string(),
      online: z.boolean(),
      id: z.string().optional(),
    })),
  }),
]);

export type GameEvent = z.infer<typeof gameEventSchema>;
