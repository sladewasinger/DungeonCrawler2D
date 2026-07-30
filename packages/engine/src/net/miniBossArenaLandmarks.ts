import { z } from "zod";
import {
  MAX_MINI_BOSS_ARENA_COMPASS_LANDMARKS,
} from "../world/features/miniBossArena/miniBossArenaCompass.js";

/** Authoritative defeated-arena state within the receiver's compass window. */
export const defeatedMiniBossArenaSnapshotSchema = z.object({
  cx: z.number().int(),
  cy: z.number().int(),
});

export const defeatedMiniBossArenaWindowSchema = z.array(
  defeatedMiniBossArenaSnapshotSchema,
).max(MAX_MINI_BOSS_ARENA_COMPASS_LANDMARKS);

export type DefeatedMiniBossArenaSnapshot = z.infer<
  typeof defeatedMiniBossArenaSnapshotSchema
>;
