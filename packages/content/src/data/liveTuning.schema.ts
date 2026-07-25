/** Validates the versioned balance values shared by authored content, server simulation, and clients. */
import { z } from "zod";

const bandageStatusSchema = z.object({
  id: z.literal("bandaged"),
  name: z.string().min(1),
  kind: z.literal("buff"),
  tags: z.array(z.string()).min(1),
  stacking: z.literal("refresh"),
});

const bandageTuningSchema = z.object({
  status: bandageStatusSchema,
  immediateHeal: z.number().positive(),
  durationSeconds: z.number().positive(),
  tickEverySeconds: z.number().positive(),
  healPerTick: z.number().positive(),
}).refine(
  ({ durationSeconds, tickEverySeconds }) =>
    Number.isInteger(durationSeconds / tickEverySeconds),
  { message: "bandage duration must contain a whole number of healing ticks" },
);

export const liveTuningSchema = z.object({
  version: z.literal(1),
  bandage: bandageTuningSchema,
});

export type LiveTuning = z.infer<typeof liveTuningSchema>;

export const parseLiveTuning = (value: unknown): LiveTuning =>
  liveTuningSchema.parse(value);
