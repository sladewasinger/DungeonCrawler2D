// Parses raw content JSON into id-keyed maps per domain schema, before cross-reference checks.
import type { z } from "zod";
import { areaDefSchema, type AreaDef } from "./areas.js";
import { enemyDefSchema, type EnemyDef } from "./enemies.js";
import { itemDefSchema, type ItemDef } from "./items.js";
import { recipeDefSchema, type RecipeDef } from "./recipes.js";
import { interactionRuleSchema, statusDefSchema, type InteractionRule, type StatusDef } from "./statuses.js";
import type { RawContent } from "./registry.js";

export interface ParsedContent {
  statuses: Map<string, StatusDef>;
  rules: InteractionRule[];
  areas: Map<string, AreaDef>;
  items: Map<string, ItemDef>;
  enemies: Map<string, EnemyDef>;
  recipes: Map<string, RecipeDef>;
}

export function parseContent(raw: RawContent): ParsedContent {
  return {
    statuses: parseStatuses(raw.statuses),
    rules: raw.rules.map((r) => interactionRuleSchema.parse(r)),
    areas: parseKeyedMap(raw.areas, areaDefSchema),
    items: parseKeyedMap(raw.items, itemDefSchema),
    enemies: parseKeyedMap(raw.enemies, enemyDefSchema),
    recipes: parseKeyedMap(raw.recipes, recipeDefSchema),
  };
}

/** Statuses alone reject duplicate ids: every other primitive is keyed last-write-wins, matching v1. */
function parseStatuses(raw: unknown[]): Map<string, StatusDef> {
  const statuses = new Map<string, StatusDef>();
  for (const s of raw) {
    const def = statusDefSchema.parse(s);
    if (statuses.has(def.id)) throw new Error(`duplicate status ${def.id}`);
    statuses.set(def.id, def);
  }
  return statuses;
}

function parseKeyedMap<T extends { id: string }>(raw: unknown[], schema: z.ZodType<T>): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of raw) {
    const def = schema.parse(item);
    map.set(def.id, def);
  }
  return map;
}
