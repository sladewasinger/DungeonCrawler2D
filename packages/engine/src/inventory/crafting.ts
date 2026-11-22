/** Pure recipe validation and execution against a 36-slot inventory. */
import { cloneInventoryState } from "./armorOps.js";
import {
  insertIntoSlots,
  type InventorySlot,
  type PlayerInventoryState,
  type StackLimitLookup,
} from "./slotModel.js";

export interface RecipeIngredient {
  readonly itemId: string;
  readonly count: number;
}

export interface CraftRecipe {
  readonly id: string;
  readonly outputItemId: string;
  readonly outputCount: number;
  readonly requiresCampfire?: boolean | undefined;
  readonly ingredients: readonly RecipeIngredient[];
}

export function countItemInSlots(slots: readonly InventorySlot[], itemId: string): number {
  let total = 0;
  for (const slot of slots) {
    if (slot?.itemId === itemId) total += slot.count;
  }
  return total;
}

function consumeSingleIngredient(slots: InventorySlot[], req: RecipeIngredient): boolean {
  let remaining = req.count;
  for (let i = slots.length - 1; i >= 0 && remaining > 0; i--) {
    const slot = slots[i];
    if (slot?.itemId !== req.itemId) continue;
    const take = Math.min(remaining, slot.count);
    slots[i] = slot.count > take ? { itemId: slot.itemId, count: slot.count - take } : null;
    remaining -= take;
  }
  return remaining === 0;
}

function consumeAllIngredients(slots: InventorySlot[], ingredients: readonly RecipeIngredient[]): boolean {
  for (const ingredient of ingredients) {
    if (!consumeSingleIngredient(slots, ingredient)) return false;
  }
  return true;
}

/** Checks whether the inventory contains ingredients, campfire proximity, and space for output. */
export function canCraftRecipe(input: {
  readonly slots: readonly InventorySlot[];
  readonly recipe: CraftRecipe;
  readonly nearCampfire: boolean;
  readonly maxStackFor: StackLimitLookup;
}): boolean {
  const result = craftRecipeInState(
    { slots: [...input.slots], armor: { head: null, chest: null, legs: null, feet: null, offhand: null } },
    { recipe: input.recipe, nearCampfire: input.nearCampfire, maxStackFor: input.maxStackFor },
  );
  return result !== null;
}

/** Consumes recipe ingredients from `state.slots` and inserts the crafted result cleanly. */
export function craftRecipeInState(
  state: PlayerInventoryState,
  req: {
    readonly recipe: CraftRecipe;
    readonly nearCampfire: boolean;
    readonly maxStackFor: StackLimitLookup;
  },
): PlayerInventoryState | null {
  if (req.recipe.requiresCampfire && !req.nearCampfire) return null;
  for (const ing of req.recipe.ingredients) {
    if (countItemInSlots(state.slots, ing.itemId) < ing.count) return null;
  }

  const next = cloneInventoryState(state);
  if (!consumeAllIngredients(next.slots, req.recipe.ingredients)) return null;
  const added = insertIntoSlots(
    next.slots,
    { itemId: req.recipe.outputItemId, count: req.recipe.outputCount },
    req.maxStackFor,
  );
  return added === req.recipe.outputCount ? next : null;
}
