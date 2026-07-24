/** Renders and controls the live nine-slot Three.js hotbar. */
import type { Connection } from "../net/connection.js";
import { itemName } from "../ui/itemCatalog.js";
import { hotbarQuantity } from "./ThreeHudModel.js";
import { HUD_GOLD } from "./ThreeHudStyles.js";

const SLOT_COUNT = 9;

export class ThreeHudHotbar {
  readonly element = document.createElement("div");
  private readonly slots: HTMLButtonElement[] = [];
  private selected = -1;
  private signature = "";

  constructor(private readonly onSelect?: (index: number | null) => void) {
    this.element.style.cssText =
      "width:100%;height:100%;display:grid;" +
      "grid-template-columns:repeat(9,minmax(30px,1fr));gap:4px;align-items:end";
    for (let index = 0; index < SLOT_COUNT; index += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.style.cssText =
        "min-height:48px;padding:3px;border:1px solid #555a75;" +
        "background:rgba(27,28,44,.88);color:#e6e5ef;font:10px monospace;" +
        "white-space:pre-line;overflow:hidden;pointer-events:auto";
      button.addEventListener("click", () => this.select(index));
      this.slots.push(button);
      this.element.append(button);
    }
    this.applySelection();
  }

  update(connection: Connection, selected?: number | null): void {
    if (selected !== undefined && selected !== this.selected) {
      this.selected = selected ?? -1;
      this.applySelection();
    }
    const signature = JSON.stringify([connection.hotbar, connection.inventory]);
    if (signature === this.signature) return;
    this.signature = signature;
    this.slots.forEach((slot, index) => {
      const itemId = connection.hotbar[index] ?? null;
      const quantity = hotbarQuantity(connection.inventory, itemId);
      slot.textContent = itemId
        ? `${index + 1}\n${itemName(itemId)}${quantity > 1 ? ` ×${quantity}` : ""}`
        : String(index + 1);
      slot.title = itemId ? itemName(itemId) : `Empty slot ${index + 1}`;
    });
  }

  select(index: number): void {
    if (index < 0 || index >= SLOT_COUNT) return;
    this.selected = this.selected === index ? -1 : index;
    this.applySelection();
    this.onSelect?.(this.selected >= 0 ? this.selected : null);
  }

  selectedSlot(): number {
    return this.selected;
  }

  private applySelection(): void {
    this.slots.forEach((slot, index) => {
      slot.style.outline = index === this.selected
        ? `2px solid ${HUD_GOLD}`
        : "none";
      slot.style.outlineOffset = "-2px";
    });
  }
}
