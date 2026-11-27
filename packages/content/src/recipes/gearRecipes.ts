/** Smelting, weapon, armor set, shield, and elixir crafting recipes. */
import type { RecipeDef } from "./recipes.js";

const WOOD = "wood";
const STONE = "stone";
const HERB = "herb";
const MEAT = "raw-meat";
const COPPER = "copper-ingot";
const IRON = "iron-ingot";
const AMBER = "amber-resin";
const SPORE = "bog-spore";
const SUN = "sunstone";
const SHARD = "shadow-shard";
const CORE = "ancient-core";

export const GEAR_RECIPES: readonly RecipeDef[] = [
  { id: "smelt-copper-ingot", outputItemId: COPPER, outputCount: 1, requiresCampfire: true, ingredients: [{ itemId: "copper-ore", count: 2 }, { itemId: WOOD, count: 1 }] },
  { id: "smelt-iron-ingot", outputItemId: IRON, outputCount: 1, requiresCampfire: true, ingredients: [{ itemId: "iron-ore", count: 2 }, { itemId: WOOD, count: 1 }] },
  { id: "craft-copper-pickaxe", outputItemId: "copper-pickaxe", outputCount: 1, requiresWorkbench: true, ingredients: [{ itemId: COPPER, count: 2 }, { itemId: WOOD, count: 2 }] },
  { id: "craft-copper-axe", outputItemId: "copper-axe", outputCount: 1, requiresWorkbench: true, ingredients: [{ itemId: COPPER, count: 2 }, { itemId: WOOD, count: 2 }] },
  { id: "craft-copper-sword", outputItemId: "copper-sword", outputCount: 1, requiresWorkbench: true, ingredients: [{ itemId: COPPER, count: 3 }, { itemId: WOOD, count: 1 }] },
  { id: "craft-copper-spear", outputItemId: "copper-spear", outputCount: 1, requiresWorkbench: true, ingredients: [{ itemId: COPPER, count: 2 }, { itemId: WOOD, count: 3 }] },
  { id: "craft-bog-dagger", outputItemId: "bog-dagger", outputCount: 1, requiresWorkbench: true, ingredients: [{ itemId: "flint", count: 2 }, { itemId: SPORE, count: 2 }, { itemId: WOOD, count: 1 }] },
  { id: "craft-amber-recurve-bow", outputItemId: "amber-recurve-bow", outputCount: 1, requiresWorkbench: true, ingredients: [{ itemId: WOOD, count: 4 }, { itemId: AMBER, count: 3 }, { itemId: HERB, count: 2 }] },
  { id: "craft-frost-hatchet", outputItemId: "frost-hatchet", outputCount: 1, requiresCampfire: true, requiresWorkbench: true, ingredients: [{ itemId: IRON, count: 3 }, { itemId: SUN, count: 1 }, { itemId: WOOD, count: 2 }] },
  { id: "craft-golem-maul", outputItemId: "golem-maul", outputCount: 1, requiresCampfire: true, requiresWorkbench: true, ingredients: [{ itemId: IRON, count: 4 }, { itemId: STONE, count: 4 }, { itemId: CORE, count: 1 }] },
  { id: "craft-shadowfang-spear", outputItemId: "shadowfang-spear", outputCount: 1, requiresCampfire: true, requiresWorkbench: true, ingredients: [{ itemId: IRON, count: 4 }, { itemId: SHARD, count: 5 }, { itemId: CORE, count: 1 }, { itemId: WOOD, count: 2 }] },
  { id: "craft-reinforced-shield", outputItemId: "reinforced-shield", outputCount: 1, requiresWorkbench: true, ingredients: [{ itemId: COPPER, count: 2 }, { itemId: WOOD, count: 5 }] },
  { id: "craft-runic-buckler", outputItemId: "runic-buckler", outputCount: 1, requiresCampfire: true, requiresWorkbench: true, ingredients: [{ itemId: IRON, count: 3 }, { itemId: SUN, count: 1 }] },
  { id: "craft-moss-stalker-hood", outputItemId: "moss-stalker-hood", outputCount: 1, requiresWorkbench: true, ingredients: [{ itemId: HERB, count: 4 }, { itemId: SPORE, count: 1 }] },
  { id: "craft-moss-stalker-tunic", outputItemId: "moss-stalker-tunic", outputCount: 1, requiresWorkbench: true, ingredients: [{ itemId: HERB, count: 6 }, { itemId: SPORE, count: 2 }] },
  { id: "craft-moss-stalker-leggings", outputItemId: "moss-stalker-leggings", outputCount: 1, requiresWorkbench: true, ingredients: [{ itemId: HERB, count: 5 }, { itemId: SPORE, count: 1 }] },
  { id: "craft-moss-stalker-boots", outputItemId: "moss-stalker-boots", outputCount: 1, requiresWorkbench: true, ingredients: [{ itemId: HERB, count: 4 }, { itemId: MEAT, count: 3 }] },
  { id: "craft-autumn-ranger-hood", outputItemId: "autumn-ranger-hood", outputCount: 1, requiresWorkbench: true, ingredients: [{ itemId: AMBER, count: 2 }, { itemId: HERB, count: 3 }] },
  { id: "craft-autumn-ranger-tunic", outputItemId: "autumn-ranger-tunic", outputCount: 1, requiresWorkbench: true, ingredients: [{ itemId: AMBER, count: 3 }, { itemId: MEAT, count: 5 }] },
  { id: "craft-autumn-ranger-leggings", outputItemId: "autumn-ranger-leggings", outputCount: 1, requiresWorkbench: true, ingredients: [{ itemId: AMBER, count: 2 }, { itemId: MEAT, count: 4 }] },
  { id: "craft-autumn-ranger-boots", outputItemId: "autumn-ranger-boots", outputCount: 1, requiresWorkbench: true, ingredients: [{ itemId: AMBER, count: 2 }, { itemId: MEAT, count: 3 }] },
  { id: "craft-iron-knight-helm", outputItemId: "iron-knight-helm", outputCount: 1, requiresCampfire: true, requiresWorkbench: true, ingredients: [{ itemId: IRON, count: 3 }] },
  { id: "craft-iron-knight-cuirass", outputItemId: "iron-knight-cuirass", outputCount: 1, requiresCampfire: true, requiresWorkbench: true, ingredients: [{ itemId: IRON, count: 5 }] },
  { id: "craft-iron-knight-greaves", outputItemId: "iron-knight-greaves", outputCount: 1, requiresCampfire: true, requiresWorkbench: true, ingredients: [{ itemId: IRON, count: 4 }] },
  { id: "craft-iron-knight-sabatons", outputItemId: "iron-knight-sabatons", outputCount: 1, requiresCampfire: true, requiresWorkbench: true, ingredients: [{ itemId: IRON, count: 3 }] },
  { id: "craft-shadowsteel-cowl", outputItemId: "shadowsteel-cowl", outputCount: 1, requiresCampfire: true, requiresWorkbench: true, ingredients: [{ itemId: IRON, count: 4 }, { itemId: SHARD, count: 5 }, { itemId: CORE, count: 1 }] },
  { id: "craft-shadowsteel-coat", outputItemId: "shadowsteel-coat", outputCount: 1, requiresCampfire: true, requiresWorkbench: true, ingredients: [{ itemId: IRON, count: 6 }, { itemId: SHARD, count: 6 }, { itemId: CORE, count: 2 }] },
  { id: "craft-swiftness-draught", outputItemId: "swiftness-draught", outputCount: 1, requiresCampfire: true, ingredients: [{ itemId: HERB, count: 2 }, { itemId: AMBER, count: 1 }] },
  { id: "craft-ironbark-tonic", outputItemId: "ironbark-tonic", outputCount: 1, requiresCampfire: true, ingredients: [{ itemId: HERB, count: 2 }, { itemId: SUN, count: 1 }] },
  { id: "craft-shadow-oil", outputItemId: "shadow-oil", outputCount: 1, requiresCampfire: true, ingredients: [{ itemId: SPORE, count: 2 }, { itemId: SHARD, count: 1 }] },
  { id: "craft-phoenix-salve", outputItemId: "phoenix-salve", outputCount: 1, requiresCampfire: true, ingredients: [{ itemId: HERB, count: 3 }, { itemId: SUN, count: 1 }] },
];
