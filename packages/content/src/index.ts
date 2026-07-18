// Public facade for @dc2d/content — re-exports the six raw content JSON files as-is;
// validation and typing happen in the engine's content registry, not here.
import statuses from "./data/statuses.json" with { type: "json" };
import rules from "./data/rules.json" with { type: "json" };
import areas from "./data/areas.json" with { type: "json" };
import items from "./data/items.json" with { type: "json" };
import enemies from "./data/enemies.json" with { type: "json" };
import recipes from "./data/recipes.json" with { type: "json" };

export const statusesData: readonly unknown[] = statuses;
export const rulesData: readonly unknown[] = rules;
export const areasData: readonly unknown[] = areas;
export const itemsData: readonly unknown[] = items;
export const enemiesData: readonly unknown[] = enemies;
export const recipesData: readonly unknown[] = recipes;
