import { z } from "zod";

export const floorGenerationIdentitySchema = z.object({
  seed: z.number().int(),
  generatorVersion: z.number().int().positive(),
  retryIndex: z.number().int().nonnegative(),
  configurationFingerprint: z.string().min(1),
  fingerprint: z.string().min(1),
  bounds: z.object({
    minX: z.number().int(), minY: z.number().int(),
    width: z.number().int().positive(), height: z.number().int().positive(),
    maxX: z.number().int(), maxY: z.number().int(),
    minChunkX: z.number().int(), minChunkY: z.number().int(),
    maxChunkX: z.number().int(), maxChunkY: z.number().int(),
  }).strict(),
}).strict();
export type FloorGenerationIdentity = z.infer<typeof floorGenerationIdentitySchema>;
