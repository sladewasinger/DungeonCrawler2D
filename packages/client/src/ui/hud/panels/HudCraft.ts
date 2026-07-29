/** Renders the HTML crafting list and emits authoritative craft intents. */
import type { CraftSnapshot } from "../../../ui/widgets/hud/core/fakeData.js";
import { createHudPanelHeader } from "../styles/HudStyles.js";
import { createHudTemplate, requireHudElement } from "../styles/hudTemplate.js";

export class HudCraft {
  readonly element: HTMLElement;
  private readonly list: HTMLElement;
  private signature = "";

  constructor(
    private readonly craft: (recipeId: string) => void,
    close: () => void,
  ) {
    this.element = createHudTemplate<HTMLElement>("hud-craft-template");
    this.list = requireHudElement(this.element, "[data-hud-craft-list]");
    this.element.replaceChildren(createHudPanelHeader("Crafting", close), this.list);
  }

  update(snapshot: CraftSnapshot): void {
    const signature = JSON.stringify(snapshot.recipes);
    if (signature === this.signature) return;
    this.signature = signature;
    this.list.replaceChildren(...snapshot.recipes.map((recipe) => {
      const row = createHudTemplate<HTMLDivElement>("hud-craft-row-template");
      const name = requireHudElement(row, "[data-hud-craft-name]");
      const description = requireHudElement(row, "[data-hud-craft-description]");
      const button = requireHudElement<HTMLButtonElement>(row, "[data-hud-craft-action]");
      const ingredients = recipe.ingredients.map((item) =>
        `${item.need}× ${item.name} (${item.have}/${item.need})`
      ).join(" · ");
      name.textContent = `${recipe.outputName} ×${recipe.outputQty}`;
      description.textContent = ingredients;
      row.dataset.craftable = String(recipe.craftable);
      button.addEventListener("click", () => this.craft(recipe.recipeId));
      button.disabled = !recipe.craftable;
      return row;
    }));
  }
}
