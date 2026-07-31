import { z } from "zod";
import { PLAYER_SKINS } from "../../entities/playerAppearance.js";
import { LEVEL, LEVEL_IDS } from "../../world/core/level.js";
import { networkProfileSchema } from "../networkProfile.js";

export const snapshotModeSchema = z.literal("delta-v1");
export type SnapshotMode = z.infer<typeof snapshotModeSchema>;
export const clientHelloSchema = z.object({
  type: z.literal("hello"), protocol: z.number().int(), name: z.string().min(1).max(16), skin: z.enum(PLAYER_SKINS).optional(),
  clientId: z.string().min(4).max(64), level: z.enum(LEVEL_IDS).default(LEVEL.Dungeon), resumeToken: z.string().max(64).optional(),
  floor: z.number().int().positive().optional(), snapshotMode: snapshotModeSchema.optional(), networkProfile: networkProfileSchema.nullable().optional(),
  clientMetadata: z.object({ userAgent: z.string().max(256), platform: z.string().max(128), touch: z.boolean() }).strict().optional(),
});
export type ClientHello = z.infer<typeof clientHelloSchema>;
