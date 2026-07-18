// Public registry type + entry point: validates raw content JSON into a cross-checked ContentRegistry.
import type { AreaDef } from "./areas.js";
import type { EnemyDef } from "./enemies.js";
import type { ItemDef } from "./items.js";
import type { RecipeDef } from "./recipes.js";
import type { InteractionRule, StatusDef } from "./statuses.js";
import { parseContent } from "./parse.js";
import { validateReferences } from "./validate.js";

export interface ContentRegistry {
  statuses: ReadonlyMap<string, StatusDef>;
  rules: readonly InteractionRule[];
  areas: ReadonlyMap<string, AreaDef>;
  items: ReadonlyMap<string, ItemDef>;
  enemies: ReadonlyMap<string, EnemyDef>;
  recipes: ReadonlyMap<string, RecipeDef>;
}

export interface RawContent {
  statuses: unknown[];
  rules: unknown[];
  areas: unknown[];
  items: unknown[];
  enemies: unknown[];
  recipes: unknown[];
}

/**
 * Validate raw JSON content into a registry, cross-checking that every
 * referenced id exists — a nonsense reference is a content bug (or a
 * rejected AI proposal), never a runtime surprise.
 */
export function buildContentRegistry(raw: RawContent): ContentRegistry {
  const content = parseContent(raw);
  validateReferences(content);
  return content;
}
