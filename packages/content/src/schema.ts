// Zod schema for the placeholder item content type. Real item/enemy/status/area/recipe
// schemas land here as gameplay is built out (docs/ARCHITECTURE.md's content package).
import { z } from "zod";

export const itemSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "content ids are kebab-case"),
  name: z.string().min(1),
  tags: z.array(z.string()).default([]),
});

export type ItemDefinition = z.infer<typeof itemSchema>;
