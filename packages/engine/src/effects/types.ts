// Facade for effects content schemas — the AI-crafting contract (docs/ENGINEERING_STANDARDS.md):
// one validator every hand-authored JSON file, test, and AI proposal must pass through.
export { primitiveSchema, type Primitive } from "./primitives.js";
export {
  statusDefSchema,
  type StatusDef,
  interactionRuleSchema,
  type InteractionRule,
} from "./statuses.js";
export { areaDefSchema, type AreaDef } from "./areas.js";
export { itemDefSchema, type ItemDef } from "./items.js";
export { enemyDefSchema, type EnemyDef } from "./enemies.js";
export { recipeDefSchema, type RecipeDef } from "./recipes.js";
export { type ContentRegistry, type RawContent, buildContentRegistry } from "./registry.js";
