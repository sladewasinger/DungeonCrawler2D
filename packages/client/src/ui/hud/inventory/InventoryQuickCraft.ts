/** Renders 1-click recipe cards directly inside the Minecraft-style inventory window. */
import { recipesData } from "@dc2d/content";
import { TILE, findWorldInteractionTarget } from "@dc2d/engine";
import type { Connection } from "../../../net/connection/connection.js";
import { itemName } from "../../../ui/presentation/itemCatalog.js";
import { itemIconDataUrl } from "../../../ui/presentation/itemIcons.js";

interface RecipeEntry {
  readonly id: string;
  readonly station?: "hand" | "table";
  readonly inputs: ReadonlyArray<{ readonly item: string; readonly qty: number }>;
  readonly output: { readonly item: string; readonly qty: number };
}

const RECIPES = recipesData as unknown as readonly RecipeEntry[];

export function isCraftingTableNearby(connection: Connection): boolean {
  const world = connection.world;
  const body = connection.body;
  if (!world || !body) return false;
  return Boolean(
    findWorldInteractionTarget({
      world,
      x: body.x,
      y: body.y,
      kind: "craft",
    })?.tile === TILE.CraftingTable,
  );
}

function ownedQty(connection: Connection, itemId: string): number {
  return connection.inventory.find((stack) => stack.item === itemId)?.qty ?? 0;
}

function canAffordRecipe(connection: Connection, recipe: RecipeEntry): boolean {
  return recipe.inputs.every((input) => ownedQty(connection, input.item) >= input.qty);
}

export function buildQuickCraftSection(connection: Connection): HTMLElement {
  const section = document.createElement("section");
  section.className = "hud-mc-craft";
  const nearTable = isCraftingTableNearby(connection);
  const header = document.createElement("div");
  header.className = "hud-mc-section-title";
  header.textContent = nearTable
    ? "Quick Craft (Hand + Workbench Active)"
    : "Quick Craft (Field Survival — Workbench for Armor/Forging)";
  const grid = document.createElement("div");
  grid.className = "hud-mc-craft__grid";
  for (const recipe of RECIPES) {
    const requiresTable = (recipe.station ?? "table") === "table";
    const stationReady = !requiresTable || nearTable;
    const affordable = canAffordRecipe(connection, recipe);
    grid.append(createRecipeCard(connection, recipe, { stationReady, affordable }));
  }
  section.append(header, grid);
  return section;
}

function createRecipeCard(
  connection: Connection,
  recipe: RecipeEntry,
  state: { stationReady: boolean; affordable: boolean },
): HTMLButtonElement {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "hud-mc-recipe-card";
  const craftable = state.stationReady && state.affordable;
  card.dataset.craftable = String(craftable);
  card.dataset.station = recipe.station ?? "table";
  card.disabled = !craftable;
  card.addEventListener("click", () => connection.craft(recipe.id));

  const icon = document.createElement("img");
  icon.className = "hud-mc-slot__icon";
  icon.src = itemIconDataUrl(recipe.output.item);
  icon.alt = itemName(recipe.output.item);

  const info = document.createElement("div");
  info.className = "hud-mc-recipe-card__info";
  const title = document.createElement("strong");
  const qtySuffix = recipe.output.qty > 1 ? ` ×${recipe.output.qty}` : "";
  title.textContent = `${itemName(recipe.output.item)}${qtySuffix}`;
  const cost = document.createElement("span");
  cost.textContent = recipe.inputs
    .map((input) => `${ownedQty(connection, input.item)}/${input.qty} ${itemName(input.item)}`)
    .join(" · ");
  info.append(title, cost);
  card.append(icon, info);
  return card;
}
