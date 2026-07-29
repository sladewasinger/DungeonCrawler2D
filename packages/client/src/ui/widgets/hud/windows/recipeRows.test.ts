import { describe, expect, it } from "vitest";
import { recipeRowViews } from "./recipeRows.js";

const nameOf = (id: string) => ({ rag: "Rag", stick: "Stick", bandage: "Bandage", torch: "Torch" })[id] ?? id;

describe("recipeRowViews", () => {
  it("reports have/need per ingredient and craftable true when every ingredient is met", () => {
    const recipes = [{ id: "bandage", inputs: [{ item: "rag", qty: 2 }], output: { item: "bandage", qty: 1 } }];
    const rows = recipeRowViews(recipes, [{ item: "rag", qty: 3 }], nameOf);
    expect(rows).toEqual([
      {
        recipeId: "bandage",
        outputId: "bandage",
        outputName: "Bandage",
        outputQty: 1,
        ingredients: [{ itemId: "rag", name: "Rag", have: 3, need: 2, met: true }],
        craftable: true,
      },
    ]);
  });

  it("is not craftable when any single ingredient is short", () => {
    const recipes = [
      {
        id: "torch",
        inputs: [
          { item: "stick", qty: 1 },
          { item: "rag", qty: 1 },
        ],
        output: { item: "torch", qty: 1 },
      },
    ];
    const rows = recipeRowViews(recipes, [{ item: "stick", qty: 1 }], nameOf);
    expect(rows[0]!.craftable).toBe(false);
    expect(rows[0]!.ingredients).toEqual([
      { itemId: "stick", name: "Stick", have: 1, need: 1, met: true },
      { itemId: "rag", name: "Rag", have: 0, need: 1, met: false },
    ]);
  });

  it("treats an item missing from inventory entirely as zero on hand", () => {
    const recipes = [{ id: "bandage", inputs: [{ item: "rag", qty: 1 }], output: { item: "bandage", qty: 1 } }];
    const rows = recipeRowViews(recipes, [], nameOf);
    expect(rows[0]!.ingredients[0]).toEqual({ itemId: "rag", name: "Rag", have: 0, need: 1, met: false });
  });

  it("preserves recipe (content) order and handles an empty recipe list", () => {
    expect(recipeRowViews([], [], nameOf)).toEqual([]);
    const recipes = [
      { id: "b", inputs: [], output: { item: "b", qty: 1 } },
      { id: "a", inputs: [], output: { item: "a", qty: 1 } },
    ];
    expect(recipeRowViews(recipes, [], nameOf).map((r) => r.recipeId)).toEqual(["b", "a"]);
  });
});
