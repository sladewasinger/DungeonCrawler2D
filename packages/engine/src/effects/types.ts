// Facade for effects content schemas — the AI-crafting contract (docs/ENGINEERING_STANDARDS.md):
// one validator every hand-authored JSON file, test, and AI proposal must pass through.
export { primitiveSchema, type Primitive } from "./primitives.js";
export {
  statusDefSchema,
  type StatusDef,
  interactionRuleSchema,
  type InteractionRule,
} from "./content/statuses.js";
export { areaDefSchema, type AreaDef } from "./content/areas.js";
export {
  areaReactionSchema,
  type AreaReaction,
  type AreaReactionAction,
} from "./content/areaReactions.js";
export { itemDefSchema, type ItemDef } from "./content/items.js";
export { enemyDefSchema, type EnemyDef } from "./content/enemies.js";
export { recipeDefSchema, type RecipeDef } from "./content/recipes.js";
export {
  inventionProvenanceSchema,
  inventionProposalSchema,
  validateInventionProposal,
  InventionReviewQueue,
  type InventionProposal,
  type InventionValidation,
  type PendingInvention,
} from "./content/inventions.js";
export { type ContentRegistry, type RawContent, buildContentRegistry } from "./content/registry.js";
