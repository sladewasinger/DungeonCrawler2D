/** Dedicated crafting panel showing craftable recipes by default (optional Show Locked toggle). */
import { RECIPE_CATALOG, getItemDef, maxStackForItem, type RecipeDef } from "@dc2d/content";
import { canCraftRecipe, countItemInSlots, type InventorySnapshot } from "@dc2d/engine";
import { ensureBuffTrayStyles } from "./buffs/buffStyles.js";
import { getItemIconUrl } from "../icons/itemIcons.js";
import { domNode, slotsFingerprint } from "./slotRenderer.js";

const TAG_DIV = "div";
const TAG_BTN = "button";
const TAG_SPAN = "span";
const CLS_PILL = "ow-pill";
const CLS_STATION_PILL = "ow-station-pill";
const CLS_SUB = "ow-craft-sub";

export class CraftingPanel {
  readonly el: HTMLElement;
  private readonly listEl: HTMLDivElement;
  private readonly stationsWrap: HTMLDivElement;
  private readonly handBadge: HTMLSpanElement;
  private readonly campfireBadge: HTMLSpanElement;
  private readonly workbenchBadge: HTMLSpanElement;
  private readonly lockedToggleBtn: HTMLButtonElement;
  private showLocked = false;
  private lastFingerprint = "";

  constructor(
    host: HTMLElement,
    private readonly onCraft: (recipeId: string) => void,
    nav: { readonly onClose: () => void; readonly onOpenInventory: () => void },
  ) {
    ensureBuffTrayStyles();
    this.el = domNode("section", "ow-modal ow-craft-modal");
    this.el.hidden = true;
    this.stationsWrap = domNode(TAG_DIV, "ow-craft-stations");
    this.handBadge = domNode(TAG_SPAN, CLS_STATION_PILL); this.handBadge.textContent = "Hand"; this.handBadge.dataset.active = "true";
    this.campfireBadge = domNode(TAG_SPAN, CLS_STATION_PILL); this.campfireBadge.textContent = "Campfire";
    this.workbenchBadge = domNode(TAG_SPAN, CLS_STATION_PILL); this.workbenchBadge.textContent = "Workbench";
    this.stationsWrap.append(this.handBadge, this.campfireBadge, this.workbenchBadge);
    this.lockedToggleBtn = domNode(TAG_BTN, CLS_PILL);
    this.lockedToggleBtn.type = TAG_BTN;
    this.lockedToggleBtn.addEventListener("click", () => {
      this.showLocked = !this.showLocked;
      this.lastFingerprint = "";
    });

    this.el.append(this.buildHeader(nav));
    this.listEl = domNode(TAG_DIV, "ow-craft-list");
    this.el.append(this.listEl);
    host.append(this.el);
  }

  private buildHeader(nav: { readonly onClose: () => void; readonly onOpenInventory: () => void }): HTMLDivElement {
    const head = domNode(TAG_DIV, "ow-modal-head");
    const left = domNode(TAG_DIV);
    left.style.display = "flex";
    left.style.alignItems = "center";
    left.style.gap = "8px";
    const title = domNode(TAG_SPAN);
    title.textContent = "Crafting";
    left.append(title, this.stationsWrap);

    const right = domNode(TAG_DIV);
    right.style.display = "flex";
    right.style.gap = "6px";
    const bagBtn = domNode(TAG_BTN, CLS_PILL);
    bagBtn.type = TAG_BTN;
    bagBtn.textContent = "Bag";
    bagBtn.addEventListener("click", nav.onOpenInventory);
    const closeBtn = domNode(TAG_BTN, CLS_PILL);
    closeBtn.type = TAG_BTN;
    closeBtn.textContent = "Close";
    closeBtn.addEventListener("click", nav.onClose);
    right.append(bagBtn, this.lockedToggleBtn, closeBtn);
    head.append(left, right);
    return head;
  }

  sync(inv: InventorySnapshot, open: boolean): void {
    this.el.hidden = !open;
    if (!open) return;

    const fp = `${slotsFingerprint(inv.slots, 0, inv.slots.length)}#${inv.nearCampfire}#${Boolean(inv.nearWorkbench)}#${this.showLocked}`;
    if (fp === this.lastFingerprint) return;
    this.lastFingerprint = fp;

    this.campfireBadge.dataset.active = String(inv.nearCampfire);
    this.workbenchBadge.dataset.active = String(Boolean(inv.nearWorkbench));
    this.lockedToggleBtn.dataset.active = String(this.showLocked);
    this.lockedToggleBtn.textContent = this.showLocked ? "Show Locked: ON" : "Show Locked";
    this.renderRecipes(inv);
  }

  private renderRecipes(inv: InventorySnapshot): void {
    const rows: HTMLElement[] = [];
    for (const recipe of RECIPE_CATALOG) {
      const craftable = canCraftRecipe({
        slots: inv.slots,
        recipe,
        nearCampfire: inv.nearCampfire,
        nearWorkbench: inv.nearWorkbench ?? false,
        maxStackFor: maxStackForItem,
      });
      if (!craftable && !this.showLocked) continue;
      rows.push(this.buildRecipeRow(inv, recipe, craftable));
    }
    if (rows.length === 0) {
      const empty = domNode(TAG_DIV, CLS_SUB);
      empty.textContent = "No craftable recipes with current materials.";
      rows.push(empty);
    }
    this.listEl.replaceChildren(...rows);
  }

  private buildRecipeRow(inv: InventorySnapshot, recipe: RecipeDef, craftable: boolean): HTMLDivElement {
    const row = domNode(TAG_DIV, "ow-craft-row");
    const icon = domNode("img", "ow-slot-img");
    icon.style.width = "32px";
    icon.style.height = "32px";
    icon.src = getItemIconUrl(recipe.outputItemId);
    icon.alt = recipe.outputItemId;

    const info = this.buildRecipeInfo(inv, recipe);
    const craftBtn = domNode(TAG_BTN, CLS_PILL);
    craftBtn.type = TAG_BTN;
    craftBtn.textContent = "Craft";
    craftBtn.disabled = !craftable;
    craftBtn.style.opacity = craftable ? "1" : "0.45";
    craftBtn.addEventListener("click", () => this.onCraft(recipe.id));

    row.append(icon, info, craftBtn);
    return row;
  }

  private buildRecipeInfo(inv: InventorySnapshot, recipe: RecipeDef): HTMLDivElement {
    const info = domNode(TAG_DIV, "ow-craft-info");
    const itemName = getItemDef(recipe.outputItemId)?.name ?? recipe.outputItemId;
    const countSuffix = maxStackForItem(recipe.outputItemId) > 1 && recipe.outputCount > 1 ? ` x${recipe.outputCount}` : "";
    const title = domNode(TAG_DIV, "ow-craft-title");
    const stationParts = [recipe.requiresCampfire ? "Campfire" : "", recipe.requiresWorkbench ? "Workbench" : ""].filter(Boolean);
    const stationTag = stationParts.length > 0 ? ` (${stationParts.join(" + ")})` : "";
    title.textContent = `${itemName}${countSuffix}${stationTag}`;

    const parts = recipe.ingredients.map((ing) => {
      const name = getItemDef(ing.itemId)?.name ?? ing.itemId;
      const have = countItemInSlots(inv.slots, ing.itemId);
      return `${name} ${have}/${ing.count}`;
    });
    const sub = domNode(TAG_DIV, CLS_SUB);
    sub.textContent = parts.join(" · ");
    info.append(title, sub);
    return info;
  }
}
