/** Zod wire schemas and constants for proximity player chat and overhead speech bubbles. */
import { z } from "zod";

export const PROXIMITY_CHAT_RADIUS = 16;
export const PROXIMITY_SHOUT_RADIUS = 34;
export const CHAT_BUBBLE_DURATION_SEC = 5.5;
export const MAX_CHAT_LENGTH = 120;

export const ClientChatSchema = z.object({
  t: z.literal("chat"),
  text: z.string().min(1).max(MAX_CHAT_LENGTH),
  shout: z.boolean().optional(),
  seq: z.number().int().nonnegative().optional(),
});

export const PlayerBubbleSchema = z.object({
  text: z.string().min(1).max(MAX_CHAT_LENGTH),
  shout: z.boolean().optional(),
  remainingSec: z.number().nonnegative(),
});

export type PlayerBubble = z.infer<typeof PlayerBubbleSchema>;

export const ChatEntrySchema = z.object({
  id: z.string(),
  senderId: z.string(),
  senderName: z.string(),
  text: z.string(),
  shout: z.boolean(),
  x: z.number(),
  y: z.number(),
  sentAtTick: z.number().int().nonnegative(),
});

export type ChatEntry = z.infer<typeof ChatEntrySchema>;
