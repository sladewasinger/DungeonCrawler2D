/** Renders and controls the live nine-slot hotbar with pixel-art icons and drag-and-drop. */
import type { Connection } from "../../../net/connection/connection.js";
import { isConsumableItem, isThrowableItem, isWeaponItem, itemName } from "../../../ui/presentation/itemCatalog.js";
import { itemIconDataUrl } from "../../../ui/presentation/itemIcons.js";
import { hotbarQuantity } from "../model/HudModel.js";
import { createHudTemplate } from "../styles/hudTemplate.js";

const SLOT_COUNT = 9;

export class HudHotbar {
  readonly element: HTMLElement;
  private readonly slots: HTMLButtonElement[] = [];
  private selected = -1;
  private signature = "";
  private lastConnection: Connection | null = null;

  constructor(private readonly onSelect?: (index: number | null) => void) {
    this.element = createHudTemplate<HTMLElement>("hud-hotbar-template");
    for (let index = 0; index < SLOT_COUNT; index += 1) {
      const button = createHudTemplate<HTMLButtonElement>("hud-hotbar-slot-template");
      button.addEventListener("click", () => this.select(index));
      this.bindDropTarget(button, index);
      this.slots.push(button);
      this.element.append(button);
    }
    this.applySelection();
  }

  update(connection: Connection, selected?: number | null): void {
    this.lastConnection = connection;
    if (selected !== undefined && selected !== this.selected) {
      this.selected = selected ?? -1;
      this.applySelection();
    }
    const signature = JSON.stringify([
      connection.hotbar,
      connection.inventory,
      connection.weapon,
    ]);
    if (signature === this.signature) return;
    this.signature = signature;
    this.slots.forEach((slot, index) => {
      const itemId = connection.hotbar[index] ?? null;
      const quantity = hotbarQuantity(connection.inventory, itemId);
      const isEquippedWeapon = itemId !== null && connection.weapon === itemId;
      slot.dataset.equipped = String(isEquippedWeapon);
      renderHotbarSlotContent(slot, { index, itemId, quantity });
      slot.title = itemId ? `${itemName(itemId)} (×${quantity})` : `Empty slot ${index + 1}`;
    });
  }

  select(index: number): void {
    if (index < 0 || index >= SLOT_COUNT) return;
    this.selected = this.selected === index ? -1 : index;
    this.applySelection();
    this.equipSelectedWeapon();
    this.onSelect?.(this.selected >= 0 ? this.selected : null);
  }

  private equipSelectedWeapon(): void {
    const conn = this.lastConnection;
    if (!conn || this.selected < 0) return;
    const itemId = conn.hotbar[this.selected];
    if (itemId) syncSelectedHotbarEquipment(conn, itemId);
  }

  selectedSlot(): number {
    return this.selected;
  }

  private bindDropTarget(button: HTMLButtonElement, index: number): void {
    button.addEventListener("dragover", (event) => {
      event.preventDefault();
    });
    button.addEventListener("drop", (event) => {
      event.preventDefault();
      const itemId = event.dataTransfer?.getData("text/plain")?.trim();
      if (!itemId || !this.lastConnection) return;
      this.lastConnection.assignSlot(index, itemId);
      if (isWeaponItem(itemId)) this.lastConnection.equip(itemId);
    });
  }

  private applySelection(): void {
    this.slots.forEach((slot, index) => {
      slot.dataset.selected = String(index === this.selected);
    });
  }
}

function syncSelectedHotbarEquipment(conn: Connection, itemId: string): void {
  if (isWeaponItem(itemId)) {
    if (conn.weapon !== itemId) conn.equip(itemId);
    return;
  }
  if ((isConsumableItem(itemId) || isThrowableItem(itemId)) && conn.weapon !== null) {
    conn.equip(null);
  }
}

function renderHotbarSlotContent(
  slot: HTMLButtonElement,
  input: { index: number; itemId: string | null; quantity: number },
): void {
  const { index, itemId, quantity } = input;
  const keySpan = document.createElement("span");
  keySpan.className = "hud-hotbar__key";
  keySpan.textContent = String(index + 1);
  if (!itemId) {
    slot.replaceChildren(keySpan);
    return;
  }
  const icon = document.createElement("img");
  icon.className = "hud-hotbar__icon";
  icon.src = itemIconDataUrl(itemId);
  icon.alt = itemName(itemId);
  icon.draggable = false;
  const countSpan = document.createElement("span");
  countSpan.className = "hud-hotbar__count";
  countSpan.textContent = quantity > 1 ? `×${quantity}` : quantity === 0 ? "0" : "";
  slot.replaceChildren(keySpan, icon, countSpan);
}
