/** Renders the HTML crafting list and emits authoritative craft intents. */
import type { CraftSnapshot } from "../ui/widgets/hud/fakeData.js";
import { HUD_MUTED, HUD_PANEL, createHudButton, createHudTitle } from "./ThreeHudStyles.js";

export class ThreeHudCraft {
  readonly element = document.createElement("div");
  private readonly list = document.createElement("div");
  private signature = "";

  constructor(private readonly craft: (recipeId: string) => void) {
    this.element.style.cssText =
      `${HUD_PANEL};display:grid;grid-template-rows:auto 1fr;gap:5px`;
    this.list.style.cssText =
      "min-height:0;overflow-y:auto;display:grid;align-content:start;gap:6px";
    this.element.append(createHudTitle("Crafting"), this.list);
  }

  update(snapshot: CraftSnapshot): void {
    const signature = JSON.stringify(snapshot.recipes);
    if (signature === this.signature) return;
    this.signature = signature;
    this.list.replaceChildren(...snapshot.recipes.map((recipe) => {
      const row = document.createElement("div");
      row.style.cssText =
        "display:grid;grid-template-columns:1fr auto;gap:5px;padding:6px;" +
        "border:1px solid #454960;background:rgba(24,25,39,.86)";
      const description = document.createElement("div");
      const ingredients = recipe.ingredients.map((item) =>
        `${item.need}× ${item.name} (${item.have}/${item.need})`
      ).join(" · ");
      description.textContent =
        `${recipe.outputName} ×${recipe.outputQty}\n${ingredients}`;
      description.style.cssText =
        `white-space:pre-wrap;color:${recipe.craftable ? "#f2f0eb" : HUD_MUTED}`;
      const button = createHudButton("craft", () => this.craft(recipe.recipeId));
      button.disabled = !recipe.craftable;
      row.append(description, button);
      return row;
    }));
  }
}
