/**
 * Pure recipe row view-model for the crafting window: per-recipe have/need
 * ingredient counts against live inventory, and whether every ingredient is
 * met — no Phaser, no content import (names are resolved by an injected
 * lookup so this stays plain-function testable, mirroring contactRows.ts).
 */

export interface RecipeIngredientDef {
  readonly item: string;
  readonly qty: number;
}

export interface RecipeDefLike {
  readonly id: string;
  readonly inputs: readonly RecipeIngredientDef[];
  readonly output: RecipeIngredientDef;
}

export interface InventoryStackLike {
  readonly item: string;
  readonly qty: number;
}

export interface RecipeIngredientView {
  itemId: string;
  name: string;
  have: number;
  need: number;
  met: boolean;
}

export interface RecipeRowView {
  recipeId: string;
  outputId: string;
  outputName: string;
  outputQty: number;
  ingredients: RecipeIngredientView[];
  craftable: boolean;
}

function qtyOf(inventory: readonly InventoryStackLike[], itemId: string): number {
  return inventory.find((stack) => stack.item === itemId)?.qty ?? 0;
}

function ingredientView(
  input: RecipeIngredientDef,
  inventory: readonly InventoryStackLike[],
  nameOf: (itemId: string) => string,
): RecipeIngredientView {
  const have = qtyOf(inventory, input.item);
  return { itemId: input.item, name: nameOf(input.item), have, need: input.qty, met: have >= input.qty };
}

/** One row per recipe, content order — craftable only when every ingredient is met. */
export function recipeRowViews(
  recipes: readonly RecipeDefLike[],
  inventory: readonly InventoryStackLike[],
  nameOf: (itemId: string) => string,
): RecipeRowView[] {
  return recipes.map((recipe) => {
    const ingredients = recipe.inputs.map((input) => ingredientView(input, inventory, nameOf));
    return {
      recipeId: recipe.id,
      outputId: recipe.output.item,
      outputName: nameOf(recipe.output.item),
      outputQty: recipe.output.qty,
      ingredients,
      craftable: ingredients.every((ingredient) => ingredient.met),
    };
  });
}
