import { z } from "zod";

export const gameEventSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("hit"), id: z.string(), amount: z.number() }),
  z.object({
    t: z.literal("health"),
    id: z.string(),
    delta: z.number(),
    kind: z.enum(["heal", "damage"]),
    source: z.literal("automatic").optional(),
    /** Authoritative combat source; clients may ignore it until messaging uses it. */
    sourceId: z.string().optional(),
  }),
  /** Presentation signal for a resolved damaging impact. Kept separate from
   * health state so invulnerability systems may restore HP without suppressing
   * blood, hit reactions, or melee-connect feedback. */
  z.object({
    t: z.literal("damageImpact"),
    id: z.string(),
    amount: z.number().positive(),
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
  z.object({
    t: z.literal("npcSpeech"),
    npcId: z.string(),
    name: z.string(),
    x: z.number(),
    y: z.number(),
    text: z.string(),
    durationMs: z.number().int().positive(),
  }),
  z.object({ t: z.literal("invite"), from: z.string(), name: z.string() }),
  z.object({
    t: z.literal("partyInviteState"),
    direction: z.enum(["incoming", "outgoing"]),
    action: z.enum(["added", "removed"]),
    id: z.string(),
    name: z.string(),
  }),
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
    t: z.literal("lootChest"),
    chestId: z.string(),
    slots: z.array(z.object({ item: z.string(), qty: z.number().int().positive() })),
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
