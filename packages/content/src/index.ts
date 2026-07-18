// Public facade for @dc2d/content — every content file is zod-validated at import
// time so a bad reference fails the build, never a session. Placeholder: one item.
import placeholderItems from "./placeholder-items.json" with { type: "json" };
import { itemSchema, type ItemDefinition } from "./schema.js";

export type { ItemDefinition };

export const items: readonly ItemDefinition[] = placeholderItems.map((item) => itemSchema.parse(item));
