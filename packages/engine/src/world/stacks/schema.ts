// zod schemas for both editor-map JSON versions this contract bridges — every
// load crosses one of these before touching migration or compile logic
// (ENGINEERING_STANDARDS.md: "all input crosses a zod schema before touching logic").

import { z } from "zod";

const torchSchema = z.object({ wx: z.number(), wy: z.number() });

const stackDirSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);

// Mirrors STACK_FEATURE's values (types.ts) — kept as literals, not a derived
// Object.values() cast, matching every other closed-vocabulary schema in this
// codebase (e.g. effects/statuses.ts's `kind`/`stacking`).
const stackFeatureSchema = z.enum([
  "doorPersonal",
  "doorParty",
  "doorExit",
  "craftingTable",
  "stash",
  "doorSafeRoom",
]);

const stackTileSchema = z.object({
  walls: z.number(),
  cap: z.string().nullable(),
  stair: z.object({ dir: stackDirSchema, height: z.number().optional() }).nullable(),
  feature: stackFeatureSchema.optional(),
});

/** v1: the format shipped before this pivot — no "version" key at all. */
export const editorMapV1Schema = z.object({
  tiles: z.array(z.number()),
  heights: z.array(z.number()),
  torches: z.array(torchSchema).optional(),
});

/** v2: explicit stacks replace the flat tiles/heights pair. */
export const editorMapV2Schema = z.object({
  version: z.literal(2),
  width: z.number().int().positive(),
  rows: z.number().int().positive(),
  stacks: z.array(stackTileSchema),
  torches: z.array(torchSchema).optional(),
});

export type EditorMapV1Input = z.infer<typeof editorMapV1Schema>;
export type EditorMapV2Input = z.infer<typeof editorMapV2Schema>;
