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
    for (const p of prims) {
      if (p.primitive === "apply_status") checkStatus(p.status, from);
      if (p.primitive === "spawn_area" && !areas.has(p.area))
        throw new Error(`${from} references unknown area "${p.area}"`);
    }
  };
}

export function validateReferences(content: ParsedContent): void {
  const checkStatus = makeCheckStatus(content.statuses);
  const checkPrimitives = makeCheckPrimitives(content.areas, checkStatus);

  for (const s of content.statuses.values()) {
    checkPrimitives(s.onApply, `status ${s.id}`);
    checkPrimitives(s.onTick, `status ${s.id}`);
    checkPrimitives(s.onExpire, `status ${s.id}`);
  }
  for (const r of content.rules) if (r.apply) checkStatus(r.apply, `rule ${r.when.join("+")}`);
  for (const a of content.areas.values())
    if (a.onEnterStatus) checkStatus(a.onEnterStatus, `area ${a.id}`);

  validateItemReferences(content.items, checkPrimitives, checkStatus);
  validateEnemyReferences(content.enemies, content.items, checkStatus);
  validateRecipeReferences(content.recipes, content.items);
}

function validateItemReferences(
  items: ReadonlyMap<string, ItemDef>,
  checkPrimitives: CheckPrimitives,
  checkStatus: CheckStatus,
): void {
  for (const i of items.values()) {
    checkPrimitives(i.consumable?.effects, `item ${i.id}`);
    checkPrimitives(i.throwable?.onImpact, `item ${i.id}`);
    for (const w of i.weapon?.applies ?? []) checkStatus(w.status, `item ${i.id}`);
  }
}

function validateEnemyReferences(
  enemies: ReadonlyMap<string, EnemyDef>,
  items: ReadonlyMap<string, ItemDef>,
  checkStatus: CheckStatus,
): void {
  for (const e of enemies.values()) {
    for (const a of e.attack.applies ?? []) checkStatus(a.status, `enemy ${e.id}`);
    for (const d of e.drops)
      if (!items.has(d.item)) throw new Error(`enemy ${e.id} drops unknown item "${d.item}"`);
  }
}

function validateRecipeReferences(recipes: ReadonlyMap<string, RecipeDef>, items: ReadonlyMap<string, ItemDef>): void {
  for (const r of recipes.values()) {
    for (const input of r.inputs)
      if (!items.has(input.item)) throw new Error(`recipe ${r.id} uses unknown item`);
    if (!items.has(r.output.item)) throw new Error(`recipe ${r.id} outputs unknown item`);
  }
}
