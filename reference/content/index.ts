import { buildContentRegistry, type ContentRegistry } from "@dc2d/engine";
import areas from "./areas.json";
import enemies from "./enemies.json";
import items from "./items.json";
import recipes from "./recipes.json";
import rules from "./rules.json";
import statuses from "./statuses.json";

/**
 * The game's content, validated at import time against the engine's
 * schemas — a bad reference fails the build/boot, never a session.
 * (v0.6: accepted AI-crafted item definitions join this registry at
 * runtime through the same validator.)
 */
export const content: ContentRegistry = buildContentRegistry({
  statuses,
  rules,
  areas,
  items,
  enemies,
  recipes,
});
