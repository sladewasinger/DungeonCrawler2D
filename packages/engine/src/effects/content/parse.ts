// Parses raw content JSON into id-keyed maps per domain schema, before cross-reference checks.
import type { z } from "zod";
import { areaDefSchema, type AreaDef } from "./areas.js";
import { areaReactionSchema, type AreaReaction } from "./areaReactions.js";
import { enemyDefSchema, type EnemyDef } from "./enemies.js";
import { itemDefSchema, type ItemDef } from "./items.js";
import { recipeDefSchema, type RecipeDef } from "./recipes.js";
import { interactionRuleSchema, statusDefSchema, type InteractionRule, type StatusDef } from "./statuses.js";
import type { RawContent } from "./registry.js";

const MAX_AREA_REACTIONS = 32;

export interface ParsedContent {
  statuses: Map<string, StatusDef>;
  rules: InteractionRule[];
  areaReactions: AreaReaction[];
  areas: Map<string, AreaDef>;
  items: Map<string, ItemDef>;
  enemies: Map<string, EnemyDef>;
  recipes: Map<string, RecipeDef>;
}

export function parseContent(raw: RawContent): ParsedContent {
  return {
    statuses: parseStatuses(raw.statuses),
    rules: raw.rules.map((rule) => interactionRuleSchema.parse(rule)),
    areaReactions: parseAreaReactions(raw.areaReactions ?? []),
    areas: parseAreas(raw.areas),
    items: parseKeyedMap(raw.items, itemDefSchema),
    enemies: parseKeyedMap(raw.enemies, enemyDefSchema),
    recipes: parseKeyedMap(raw.recipes, recipeDefSchema),
  };
}

function parseAreaReactions(raw: unknown[]): AreaReaction[] {
  const reactions = raw.map((value) => areaReactionSchema.parse(value));
  validateAreaReactionIds(reactions);
  reactions.sort(compareAreaReactions);
  return reactions;
}

function validateAreaReactionIds(reactions: readonly AreaReaction[]): void {
  if (reactions.length > MAX_AREA_REACTIONS) {
    throw new Error(`area reaction count exceeds ${MAX_AREA_REACTIONS}`);
  }
  const ids = new Set<string>();
  for (const reaction of reactions) {
    if (ids.has(reaction.id)) throw new Error(`duplicate area reaction ${reaction.id}`);
    ids.add(reaction.id);
  }
}

function compareAreaReactions(a: AreaReaction, b: AreaReaction): number {
  return b.priority - a.priority || a.id.localeCompare(b.id);
}

/** Statuses and areas reject duplicate ids. */
function parseStatuses(raw: unknown[]): Map<string, StatusDef> {
  const statuses = new Map<string, StatusDef>();
  for (const s of raw) {
    const def = statusDefSchema.parse(s);
    if (statuses.has(def.id)) throw new Error(`duplicate status ${def.id}`);
    statuses.set(def.id, def);
  }
  return statuses;
}

function parseAreas(raw: unknown[]): Map<string, AreaDef> {
  const areas = new Map<string, AreaDef>();
  for (const value of raw) {
    const area = areaDefSchema.parse(value);
    if (areas.has(area.id)) throw new Error(`duplicate area ${area.id}`);
    areas.set(area.id, area);
  }
  return areas;
}

/** Unrelated legacy content maps preserve last-write-wins semantics. */
function parseKeyedMap<T extends { id: string }>(raw: unknown[], schema: z.ZodType<T>): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of raw) {
    const def = schema.parse(item);
    map.set(def.id, def);
  }
  return map;
}
