/** Authoritative hand and campfire crafting recipes. */

export interface RecipeIngredientDef {
  readonly itemId: string;
  readonly count: number;
}

export interface RecipeDef {
  readonly id: string;
  readonly outputItemId: string;
  readonly outputCount: number;
  readonly requiresCampfire?: boolean;
  readonly ingredients: readonly RecipeIngredientDef[];
}

const ITEM_WOOD = "wood";
const ITEM_STONE = "stone";
const ITEM_FLINT = "flint";
const ITEM_RAW_MEAT = "raw-meat";
const ITEM_HERB = "herb";

export const RECIPE_CATALOG: readonly RecipeDef[] = [
  {
    id: "craft-axe",
    outputItemId: "axe",
    outputCount: 1,
    ingredients: [
      { itemId: ITEM_WOOD, count: 3 },
      { itemId: ITEM_STONE, count: 2 },
    ],
  },
  {
    id: "craft-pickaxe",
    outputItemId: "pickaxe",
    outputCount: 1,
    ingredients: [
      { itemId: ITEM_WOOD, count: 2 },
      { itemId: ITEM_STONE, count: 3 },
    ],
  },
  {
    id: "craft-torch",
    outputItemId: "torch",
    outputCount: 2,
    requiresCampfire: true,
    ingredients: [
      { itemId: ITEM_WOOD, count: 2 },
      { itemId: ITEM_FLINT, count: 1 },
    ],
  },
  {
    id: "craft-cooked-meat",
    outputItemId: "cooked-meat",
    outputCount: 1,
    requiresCampfire: true,
    ingredients: [{ itemId: ITEM_RAW_MEAT, count: 1 }],
  },
  {
    id: "craft-arrows",
    outputItemId: "arrow",
    outputCount: 4,
    ingredients: [
      { itemId: ITEM_WOOD, count: 2 },
      { itemId: ITEM_FLINT, count: 2 },
    ],
  },
  {
    id: "craft-bandage",
    outputItemId: "bandage",
    outputCount: 1,
    ingredients: [{ itemId: ITEM_HERB, count: 2 }],
  },
  {
    id: "craft-leggings",
    outputItemId: "leather-leggings",
    outputCount: 1,
    ingredients: [
      { itemId: ITEM_RAW_MEAT, count: 6 },
      { itemId: ITEM_HERB, count: 4 },
    ],
  },
  {
    id: "craft-boots",
    outputItemId: "leather-boots",
    outputCount: 1,
    ingredients: [
      { itemId: ITEM_RAW_MEAT, count: 5 },
      { itemId: ITEM_FLINT, count: 5 },
    ],
  },
  {
    id: "craft-wooden-shield",
    outputItemId: "wooden-shield",
    outputCount: 1,
    ingredients: [{ itemId: ITEM_WOOD, count: 6 }],
  },
  {
    id: "craft-herb-tea",
    outputItemId: "herb-tea",
    outputCount: 1,
    requiresCampfire: true,
    ingredients: [{ itemId: ITEM_HERB, count: 2 }, { itemId: "berry", count: 1 }],
  },
  {
    id: "craft-healing-salve",
    outputItemId: "healing-salve",
    outputCount: 1,
    requiresCampfire: true,
    ingredients: [{ itemId: ITEM_HERB, count: 3 }],
  },
  {
    id: "craft-campfire",
    outputItemId: "camp-campfire",
    outputCount: 1,
    ingredients: [{ itemId: ITEM_WOOD, count: 4 }, { itemId: ITEM_STONE, count: 3 }],
  },
  {
    id: "craft-standing-torch",
    outputItemId: "standing-torch",
    outputCount: 2,
    ingredients: [{ itemId: ITEM_WOOD, count: 2 }, { itemId: ITEM_FLINT, count: 1 }],
  },
  {
    id: "craft-workbench",
    outputItemId: "workbench",
    outputCount: 1,
    ingredients: [{ itemId: ITEM_WOOD, count: 6 }, { itemId: ITEM_STONE, count: 2 }],
  },
  {
    id: "craft-storage-chest",
    outputItemId: "storage-chest",
    outputCount: 1,
    ingredients: [{ itemId: ITEM_WOOD, count: 6 }],
  },
  {
    id: "craft-camp-bed",
    outputItemId: "camp-bed",
    outputCount: 1,
    ingredients: [{ itemId: ITEM_WOOD, count: 6 }, { itemId: ITEM_HERB, count: 3 }],
  },
  {
    id: "craft-wood-palisade",
    outputItemId: "wood-palisade",
    outputCount: 2,
    ingredients: [{ itemId: ITEM_WOOD, count: 4 }],
  },
];

const RECIPE_MAP = new Map<string, RecipeDef>(RECIPE_CATALOG.map((recipe) => [recipe.id, recipe]));

export function getRecipeDef(recipeId: string): RecipeDef | undefined {
  return RECIPE_MAP.get(recipeId);
}
