// Cross-reference checks — a content file naming an id that doesn't exist is a bug (or a
// rejected AI proposal), never a runtime surprise.
import type { AreaDef } from "./areas.js";
import type { EnemyDef } from "./enemies.js";
import type { ItemDef } from "./items.js";
import type { Primitive } from "./primitives.js";
import type { RecipeDef } from "./recipes.js";
import type { StatusDef } from "./statuses.js";
import type { ParsedContent } from "./parse.js";

type CheckStatus = (id: string, from: string) => void;
type CheckPrimitives = (prims: readonly Primitive[] | undefined, from: string) => void;

function makeCheckStatus(statuses: ReadonlyMap<string, StatusDef>): CheckStatus {
  return (id, from) => {
    if (!statuses.has(id)) throw new Error(`${from} references unknown status "${id}"`);
  };
}

function makeCheckPrimitives(areas: ReadonlyMap<string, AreaDef>, checkStatus: CheckStatus): CheckPrimitives {
  return (prims, from) => {
    if (!prims) return;
    for (const primitive of prims) validatePrimitive({ primitive, from, areas, checkStatus });
  };
}

function validatePrimitive({ primitive, from, areas, checkStatus }: {
  primitive: Primitive;
  from: string;
  areas: ReadonlyMap<string, AreaDef>;
  checkStatus: CheckStatus;
}): void {
  if (primitive.primitive === "apply_status") checkStatus(primitive.status, from);
  if (primitive.primitive === "spawn_area" && !areas.has(primitive.area)) throw new Error(`${from} references unknown area "${primitive.area}"`);
}

export function validateReferences(content: ParsedContent): void {
  const checkStatus = makeCheckStatus(content.statuses);
  const checkPrimitives = makeCheckPrimitives(content.areas, checkStatus);

  for (const status of content.statuses.values()) validateStatusPrimitives(status, checkPrimitives);
  for (const rule of content.rules) validateRuleStatus(rule.apply, `rule ${rule.when.join("+")}`, checkStatus);
  for (const area of content.areas.values()) validateRuleStatus(area.onEnterStatus, `area ${area.id}`, checkStatus);

  validateItemReferences(content.items, checkPrimitives, checkStatus);
  validateEnemyReferences(content.enemies, content.items, checkStatus);
  validateRecipeReferences(content.recipes, content.items);
}

function validateStatusPrimitives(status: StatusDef, checkPrimitives: CheckPrimitives): void {
  const from = `status ${status.id}`;
  for (const primitives of [status.onApply, status.onRefresh, status.onTick, status.onExpire]) checkPrimitives(primitives, from);
}

function validateRuleStatus(statusId: string | undefined, from: string, checkStatus: CheckStatus): void {
  if (statusId) checkStatus(statusId, from);
}

function validateItemReferences(
  items: ReadonlyMap<string, ItemDef>,
  checkPrimitives: CheckPrimitives,
  checkStatus: CheckStatus,
): void {
  for (const i of items.values()) {
    checkPrimitives(i.consumable?.effects, `item ${i.id}`);
    checkPrimitives(i.throwable?.onImpact, `item ${i.id}`);
    for (const application of i.weapon?.applies ?? []) checkStatus(application.status, `item ${i.id}`);
  }
}

function validateEnemyReferences(
  enemies: ReadonlyMap<string, EnemyDef>,
  items: ReadonlyMap<string, ItemDef>,
  checkStatus: CheckStatus,
): void {
  for (const e of enemies.values()) {
    for (const application of e.attack.applies ?? []) checkStatus(application.status, `enemy ${e.id}`);
    for (const drop of e.drops) validateEnemyDrop(drop.item, e.id, items);
  }
}

function validateEnemyDrop(itemId: string, enemyId: string, items: ReadonlyMap<string, ItemDef>): void {
  if (!items.has(itemId)) throw new Error(`enemy ${enemyId} drops unknown item "${itemId}"`);
}

function validateRecipeReferences(recipes: ReadonlyMap<string, RecipeDef>, items: ReadonlyMap<string, ItemDef>): void {
  for (const r of recipes.values()) {
    for (const input of r.inputs) validateRecipeItem(items, input.item, `${r.id} uses`);
    validateRecipeItem(items, r.output.item, `${r.id} outputs`);
  }
}

function validateRecipeItem(items: ReadonlyMap<string, ItemDef>, itemId: string, action: string): void {
  if (!items.has(itemId)) throw new Error(`recipe ${action} unknown item`);
}
