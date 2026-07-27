/** Renders and controls the live nine-slot Three.js hotbar. */
import type { Connection } from "../../../net/connection/connection.js";
import { itemName } from "../../../ui/presentation/itemCatalog.js";
import { hotbarQuantity } from "../model/HudModel.js";
import { createHudTemplate } from "../styles/hudTemplate.js";

const SLOT_COUNT = 9;

export class HudHotbar {
  readonly element: HTMLElement;
  private readonly slots: HTMLButtonElement[] = [];
  private selected = -1;
  private signature = "";

  constructor(private readonly onSelect?: (index: number | null) => void) {
    this.element = createHudTemplate<HTMLElement>("hud-hotbar-template");
    for (let index = 0; index < SLOT_COUNT; index += 1) {
      const button = createHudTemplate<HTMLButtonElement>("hud-hotbar-slot-template");
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
      slot.dataset.selected = String(index === this.selected);
    });
  }
}
