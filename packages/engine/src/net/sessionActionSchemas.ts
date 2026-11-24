/** Zod wire schemas for player item dropping and RTT latency ping/pong messages. */
import { z } from "zod";

export const ClientDropItemSchema = z.object({
  t: z.literal("dropItem"),
  source: z.enum(["inv", "armor", "chest"]),
  slotIndex: z.number().int().min(0).max(35).optional(),
  armorSlot: z.enum(["head", "chest", "legs", "feet", "offhand"]).optional(),
  chestId: z.string().min(1).max(64).optional(),
  count: z.number().int().min(1).max(999).optional(),
  seq: z.number().int().nonnegative().optional(),
});

export type DropItemRequest = Omit<z.infer<typeof ClientDropItemSchema>, "t" | "seq">;

export const ClientPingSchema = z.object({
  t: z.literal("ping"),
  t0: z.number(),
});

export const ServerPongSchema = z.object({
  t: z.literal("pong"),
  t0: z.number(),
});
