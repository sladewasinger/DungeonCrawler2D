import { z } from "zod";
import {
  MAX_MINI_BOSS_ARENA_COMPASS_LANDMARKS,
} from "../world/features/miniBossArena/miniBossArenaCompass.js";

/** A defeated mini-boss arena inside the authoritative compass window. */
export const defeatedMiniBossArenaSnapshotSchema = z.object({
  cx: z.number().int(),
  cy: z.number().int(),
});

const compassWindowCenterSchema = z.object({
  cx: z.number().int(),
  cy: z.number().int(),
});

/**
 * Complete defeat state for one server-selected compass window. Clients must
 * derive mini-boss candidates from `center`, not a locally predicted chunk.
 */
export const defeatedMiniBossArenaWindowSchema = z.object({
  center: compassWindowCenterSchema,
  arenas: z.array(defeatedMiniBossArenaSnapshotSchema)
    .max(MAX_MINI_BOSS_ARENA_COMPASS_LANDMARKS),
});

export type DefeatedMiniBossArenaSnapshot = z.infer<
  typeof defeatedMiniBossArenaSnapshotSchema
>;

export type DefeatedMiniBossArenaWindow = z.infer<
  typeof defeatedMiniBossArenaWindowSchema
>;
