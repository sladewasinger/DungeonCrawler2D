import { z } from "zod";
import { PLAYER_SKINS } from "../../entities/playerAppearance.js";
import { LEVEL_IDS } from "../../world/core/level.js";

export const spectatorModeSchema = z.enum(["free", "track"]);
const spectatorPlayerIdSchema = z.string().min(1).max(64);

export const clientSpectatorHelloSchema = z.object({
  type: z.literal("spectatorHello"),
  protocol: z.number().int(),
  mode: spectatorModeSchema.default("free"),
  playerId: spectatorPlayerIdSchema.optional(),
}).strict();

export const clientSpectatorCommandSchema = z.object({
  type: z.literal("spectatorCommand"),
  action: z.enum(["cycle", "target", "mode"]),
  direction: z.enum(["next", "previous"]).optional(),
  playerId: spectatorPlayerIdSchema.optional(),
  mode: spectatorModeSchema.optional(),
}).strict();

export const spectatorPlayerSchema = z.object({
  playerId: spectatorPlayerIdSchema,
  name: z.string().min(1).max(16),
  skin: z.enum(PLAYER_SKINS),
  level: z.enum(LEVEL_IDS),
  floor: z.number().int().positive(),
}).strict();

export const spectatorWelcomeSchema = z.object({
  type: z.literal("spectatorWelcome"),
  protocol: z.number().int(),
  seedInputText: z.string(),
  worldSeed: z.number().int(),
  worldFeatures: z.object({ voidTerrain: z.boolean() }).strict(),
  tickRate: z.number().int(),
  target: spectatorPlayerSchema,
  mode: spectatorModeSchema,
  spawn: z.object({ x: z.number(), y: z.number(), z: z.number() }).strict(),
}).strict();

export const spectatorRosterSchema = z.object({
  type: z.literal("spectatorRoster"),
  players: z.array(spectatorPlayerSchema).max(256),
  playerId: spectatorPlayerIdSchema.nullable(),
  mode: spectatorModeSchema,
}).strict();

export const spectatorDeathPresentationSchema = z.object({
  id: z.string().min(1),
  occurredAtTick: z.number().int().nonnegative(),
  x: z.number(),
  y: z.number(),
  defId: z.string().optional(),
  targetKind: z.enum(["player", "enemy"]),
  skin: z.enum(PLAYER_SKINS).optional(),
}).strict();

export const spectatorPresentationSchema = z.object({
  type: z.literal("spectatorPresentation"),
  worldIdentity: z.string().min(1),
  tick: z.number().int().nonnegative(),
  deaths: z.array(spectatorDeathPresentationSchema).max(24),
}).strict();

export type ClientSpectatorHello = z.infer<typeof clientSpectatorHelloSchema>;
export type ClientSpectatorCommand = z.infer<typeof clientSpectatorCommandSchema>;
export type SpectatorMode = z.infer<typeof spectatorModeSchema>;
export type SpectatorPlayer = z.infer<typeof spectatorPlayerSchema>;
export type SpectatorWelcome = z.infer<typeof spectatorWelcomeSchema>;
export type SpectatorRoster = z.infer<typeof spectatorRosterSchema>;
export type SpectatorDeathPresentation = z.infer<typeof spectatorDeathPresentationSchema>;
export type SpectatorPresentation = z.infer<typeof spectatorPresentationSchema>;
