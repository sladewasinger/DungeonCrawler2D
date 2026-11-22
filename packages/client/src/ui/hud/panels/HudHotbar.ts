/** Renders and controls the live nine-slot hotbar with real owned items and drag-and-drop. */
import type { Connection } from "../../../net/connection/connection.js";
import { isConsumableItem, isThrowableItem, isWeaponItem, itemName } from "../../../ui/presentation/itemCatalog.js";
import { itemIconDataUrl } from "../../../ui/presentation/itemIcons.js";
import { readInventoryDragPayload, writeInventoryDragPayload } from "../inventory/inventoryDragPayload.js";
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
      this.bindSlotDragAndDrop(button, index);
      this.slots.push(button);
      this.element.append(button);
    }
    this.applySelection();
  }

  update(connection: Connection, selected?: number | null): void {
    this.lastConnection = connection;
    this.syncExternalSelection(connection, selected);
    const signature = JSON.stringify([connection.hotbar, connection.inventory, connection.weapon]);
    if (signature === this.signature) return;
    this.signature = signature;
    this.slots.forEach((slot, index) => this.renderSlot(slot, connection, index));
  }

  private syncExternalSelection(connection: Connection, selected?: number | null): void {
    if (selected !== undefined && selected !== this.selected) {
      this.selected = selected ?? -1;
      this.applySelection();
    }
    if (this.selected < 0 || ownedHotbarItem(connection, this.selected)) return;
    this.selected = -1;
    this.applySelection();
    this.onSelect?.(null);
  }

  private renderSlot(slot: HTMLButtonElement, connection: Connection, index: number): void {
    const itemId = ownedHotbarItem(connection, index);
    const quantity = hotbarQuantity(connection.inventory, itemId);
    slot.draggable = itemId !== null;
    delete slot.dataset.equipped;
    renderHotbarSlotContent(slot, { index, itemId, quantity });
    slot.title = itemId ? `${itemName(itemId)} (×${quantity})` : `Empty slot ${index + 1}`;
  }

  select(index: number): void {
    if (index < 0 || index >= SLOT_COUNT) return;
    const conn = this.lastConnection;
    const itemId = conn ? ownedHotbarItem(conn, index) : null;
    if (!conn || !itemId || this.selected === index) {
      this.clearSelection(conn);
      return;
    }
    this.selected = index;
    this.applySelection();
    syncSelectedHotbarEquipment(conn, itemId);
    this.onSelect?.(index);
  }

  private clearSelection(conn: Connection | null): void {
    this.selected = -1;
    this.applySelection();
    if (conn && conn.weapon !== null) conn.equip(null);
    this.onSelect?.(null);
  }

  selectedSlot(): number {
    return this.selected;
  }

  private bindSlotDragAndDrop(button: HTMLButtonElement, index: number): void {
    button.addEventListener("dragstart", (event) => this.startSlotDrag(event, index));
    button.addEventListener("dragover", (event) => event.preventDefault());
    button.addEventListener("drop", (event) => this.handleSlotDrop(event, index));
  }

  private startSlotDrag(event: DragEvent, index: number): void {
    const conn = this.lastConnection;
    const itemId = conn ? ownedHotbarItem(conn, index) : null;
    if (itemId) writeInventoryDragPayload(event.dataTransfer, { source: "hotbar", itemId, fromSlot: index });
  }

  private handleSlotDrop(event: DragEvent, index: number): void {
    event.preventDefault();
    const payload = readInventoryDragPayload(event.dataTransfer);
    const conn = this.lastConnection;
    if (!payload || !conn) return;
    if (payload.source === "armor" && payload.armorSlot) conn.equip(null, payload.armorSlot);
    conn.assignSlot(index, payload.itemId);
    if (this.selected === index) syncSelectedHotbarEquipment(conn, payload.itemId);
  }

  private applySelection(): void {
    this.slots.forEach((slot, index) => {
      slot.dataset.selected = String(index === this.selected);
    });
  }
}

function ownedHotbarItem(conn: Connection, index: number): string | null {
  const itemId = conn.hotbar[index] ?? null;
  return itemId && hotbarQuantity(conn.inventory, itemId) > 0 ? itemId : null;
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
  if (!itemId || quantity <= 0) {
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
  countSpan.textContent = quantity > 1 ? `×${quantity}` : "";
  slot.replaceChildren(keySpan, icon, countSpan);
}
