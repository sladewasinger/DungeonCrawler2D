// Crafting recipe defs — item inputs consumed for a single item output.
import { z } from "zod";

export const recipeDefSchema = z.object({
  id: z.string(),
  inputs: z.array(z.object({ item: z.string(), qty: z.number().int().min(1) })),
  output: z.object({ item: z.string(), qty: z.number().int().min(1) }),
});
export type RecipeDef = z.infer<typeof recipeDefSchema>;
