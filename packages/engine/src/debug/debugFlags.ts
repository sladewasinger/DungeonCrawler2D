import { z } from "zod";

export const DEBUG_FLAG_NAMES = [
  "hurtboxes",
  "movementCollision",
  "attacks",
  "hitboxPreview",
  "guards",
  "lineOfSight",
  "behavior",
  "search",
  "navigation",
] as const;

export type DebugFlag = (typeof DEBUG_FLAG_NAMES)[number];

export const debugFlagsSchema = z.object({
  hurtboxes: z.boolean(),
  movementCollision: z.boolean(),
  attacks: z.boolean(),
  hitboxPreview: z.boolean(),
  guards: z.boolean(),
  lineOfSight: z.boolean(),
  behavior: z.boolean(),
  search: z.boolean(),
  navigation: z.boolean(),
}).strict();

export type DebugFlags = z.infer<typeof debugFlagsSchema>;

export function createDebugFlags(): DebugFlags {
  return {
    hurtboxes: false,
    movementCollision: false,
    attacks: false,
    hitboxPreview: false,
    guards: false,
    lineOfSight: false,
    behavior: false,
    search: false,
    navigation: false,
  };
}
