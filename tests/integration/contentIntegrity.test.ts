/** Cross-package integration invariants for item catalog, recipes, starters, and harvest drops. */
import { describe, expect, it } from "vitest";
import { ITEM_CATALOG, RECIPE_CATALOG, STARTER_ARMOR, STARTER_LOADOUT, getItemDef } from "@dc2d/content";
import { HARVEST_NODE_SPECS } from "@dc2d/engine";

function assertHarvestDropsValid(): void {
  for (const spec of Object.values(HARVEST_NODE_SPECS)) {
    if (!spec) continue;
    for (const drop of spec.drops) {
      expect(getItemDef(drop.itemId), `Invalid harvest drop '${drop.itemId}'`).toBeDefined();
    }
  }
}

describe("content integrity invariants", () => {
  it("validates every ITEM_CATALOG item has unique id, description, rarity, and positive maxStack", () => {
    const seen = new Set<string>();
    for (const item of ITEM_CATALOG) {
      expect(seen.has(item.id), `Duplicate item id: ${item.id}`).toBe(false);
      seen.add(item.id);
      expect(item.name.trim().length).toBeGreaterThan(0);
      expect(item.description?.trim().length ?? 0, `Missing description on ${item.id}`).toBeGreaterThan(0);
      expect(["common", "uncommon", "rare", "epic", "legendary"]).toContain(item.rarity ?? "common");
      expect(item.maxStack).toBeGreaterThanOrEqual(1);
    }
  });

  it("validates every RECIPE_CATALOG output and ingredient exists in ITEM_CATALOG", () => {
    const seen = new Set<string>();
    for (const recipe of RECIPE_CATALOG) {
      expect(seen.has(recipe.id), `Duplicate recipe id: ${recipe.id}`).toBe(false);
      seen.add(recipe.id);
      expect(getItemDef(recipe.outputItemId), `Missing output '${recipe.outputItemId}' in ${recipe.id}`).toBeDefined();
      expect(recipe.outputCount).toBeGreaterThanOrEqual(1);
      expect(recipe.ingredients.length).toBeGreaterThan(0);
      for (const ing of recipe.ingredients) {
        expect(getItemDef(ing.itemId), `Missing ingredient '${ing.itemId}' in ${recipe.id}`).toBeDefined();
        expect(ing.count).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("validates starter gear and HARVEST_NODE_SPECS drops reference valid items", () => {
    for (const entry of STARTER_LOADOUT) {
      expect(getItemDef(entry.itemId), `Invalid starter item: ${entry.itemId}`).toBeDefined();
    }
    for (const itemId of Object.values(STARTER_ARMOR)) {
      if (itemId) expect(getItemDef(itemId), `Invalid starter armor: ${itemId}`).toBeDefined();
    }
    assertHarvestDropsValid();
  });
});
