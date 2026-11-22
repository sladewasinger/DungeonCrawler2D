/** Authoritative multiplayer WebSocket wire protocol schemas. */
import { z } from "zod";

export const PROTOCOL_VERSION = 1;

export const ClientHelloSchema = z.object({
  t: z.literal("hello"),
  version: z.literal(PROTOCOL_VERSION),
  name: z.string().min(1).max(24),
});

export const ClientInputSchema = z.object({
  t: z.literal("input"),
  seq: z.number().int().nonnegative(),
  moveX: z.number().min(-1).max(1),
  moveY: z.number().min(-1).max(1),
});

export const ClientTorchToggleSchema = z.object({
  t: z.literal("toggleTorch"),
});

export const ClientSetDayPhaseSchema = z.object({
  t: z.literal("setDayPhase"),
  dayPhase: z.number().min(0).max(1),
  paused: z.boolean().optional(),
});

export const ClientMessageSchema = z.discriminatedUnion("t", [
  ClientHelloSchema,
  ClientInputSchema,
  ClientTorchToggleSchema,
  ClientSetDayPhaseSchema,
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export const PlayerSnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  x: z.number(),
  y: z.number(),
  elevation: z.number(),
  facingX: z.number(),
  facingY: z.number(),
  moving: z.boolean(),
  torchLit: z.boolean(),
  inWater: z.boolean(),
  lastAckSeq: z.number().int(),
});

export type PlayerSnapshot = z.infer<typeof PlayerSnapshotSchema>;

export const ServerWelcomeSchema = z.object({
  t: z.literal("welcome"),
  playerId: z.string(),
  worldSeed: z.number().int(),
  dayPhase: z.number(),
  dayPaused: z.boolean(),
  tickRate: z.number(),
});

export const ServerSnapshotSchema = z.object({
  t: z.literal("snapshot"),
  tick: z.number().int().nonnegative(),
  dayPhase: z.number(),
  dayPaused: z.boolean(),
  players: z.array(PlayerSnapshotSchema),
});

export const ServerMessageSchema = z.discriminatedUnion("t", [
  ServerWelcomeSchema,
  ServerSnapshotSchema,
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;
