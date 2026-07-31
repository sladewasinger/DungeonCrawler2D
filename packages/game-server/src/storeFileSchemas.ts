import { z } from "zod";

const stashEntrySchema = z.object({
  item: z.string().min(1),
  qty: z.number().int().positive(),
}).strict();

export const versionOnePlayerSchema = z.object({
  slot: z.number().int().nonnegative(),
  name: z.string(),
  stash: z.array(stashEntrySchema),
  hotbar: z.array(z.string().nullable()).optional(),
  starterHotbarSchema: z.number().int().nonnegative().optional(),
  contacts: z.array(z.string()).optional(),
  xp: z.number().int().nonnegative().optional(),
  level: z.number().int().positive().optional(),
  deepestFloor: z.number().int().positive().optional(),
}).strict();

export const versionTwoPlayerSchema = versionOnePlayerSchema.extend({
  activeFloor: z.number().int().positive(),
  descentComplete: z.boolean(),
}).strict();

export const versionThreePlayerSchema = versionTwoPlayerSchema.extend({
  localProfileId: z.string().min(1),
  craftedRecipes: z.record(z.string(), z.number().int().nonnegative()),
  mutedProfileIds: z.array(z.string()),
  blockedProfileIds: z.array(z.string()),
}).strict();

const identitySchema = z.object({
  clientId: z.string().min(4).max(64),
  userAgent: z.string().max(256),
  platform: z.string().max(128),
  touch: z.boolean(),
  lastSeenAt: z.number().int().nonnegative(),
}).strict();

export const versionFourPlayerSchema = versionThreePlayerSchema.extend({
  identity: identitySchema.optional(),
  adminGranted: z.boolean().optional(),
  handicapGranted: z.boolean().optional(),
}).strict();

const versionOnePlayersSchema = z.record(z.string(), versionOnePlayerSchema);
export const legacyStoreSchema = z.object({
  nextSlot: z.number().int().nonnegative(),
  players: versionOnePlayersSchema,
}).strict();
export const versionOneStoreSchema = legacyStoreSchema.extend({
  version: z.literal(1),
}).strict();
export const versionTwoStoreSchema = z.object({
  version: z.literal(2),
  nextSlot: z.number().int().nonnegative(),
  players: z.record(z.string(), versionTwoPlayerSchema),
}).strict();
export const versionThreeStoreSchema = z.object({
  version: z.literal(3),
  nextSlot: z.number().int().nonnegative(),
  players: z.record(z.string(), versionThreePlayerSchema),
}).strict();
export const currentStoreSchema = z.object({
  version: z.literal(4),
  nextSlot: z.number().int().nonnegative(),
  players: z.record(z.string(), versionFourPlayerSchema),
}).strict();

export type StoredFilePlayer =
  | z.infer<typeof versionOnePlayerSchema>
  | z.infer<typeof versionTwoPlayerSchema>
  | z.infer<typeof versionThreePlayerSchema>
  | z.infer<typeof versionFourPlayerSchema>;
