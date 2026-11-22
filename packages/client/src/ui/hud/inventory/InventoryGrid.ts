/** Builds the Minecraft-style 4-Armor + Quick-Craft + 3x9 Backpack + 1x9 Hotbar grid. */
import type { Connection } from "../../../net/connection/connection.js";
import { isArmorItem, isConsumableItem, isHotbarBindableItem, isWeaponItem, itemArmorSlot, itemName } from "../../../ui/presentation/itemCatalog.js";
import { itemIconDataUrl } from "../../../ui/presentation/itemIcons.js";
import { hotbarQuantity, type InventoryRow } from "../model/HudModel.js";
import { buildArmorAndStatsSection, buildSelectedInspector } from "./InventoryArmorStats.js";
import { buildQuickCraftSection } from "./InventoryQuickCraft.js";

const BACKPACK_SLOTS = 27;
const HOTBAR_SLOTS = 9;

export interface InventoryGridState {
  selectedItemId: string | null;
  selectItem(itemId: string | null): void;
}

export function buildInventoryWorkspace(connection: Connection, rows: readonly InventoryRow[], state: InventoryGridState): HTMLElement {
  const root = document.createElement("div");
  root.className = "hud-mc-workspace";
  const topRow = document.createElement("div");
  topRow.className = "hud-mc-top";
  topRow.append(buildArmorAndStatsSection(connection, state), buildQuickCraftSection(connection));
  root.append(topRow, buildBackpackGridSection(connection, rows, state), buildSelectedInspector(connection, state), buildHotbarGridSection(connection, state));
  return root;
}

function buildBackpackGridSection(connection: Connection, rows: readonly InventoryRow[], state: InventoryGridState): HTMLElement {
  const section = document.createElement("section");
  section.className = "hud-mc-backpack";
  const title = document.createElement("div");
  title.className = "hud-mc-section-title";
  title.textContent = "Backpack (3×9 — Drag or Tap Item, then Tap Hotbar/Armor)";
  const grid = document.createElement("div");
  grid.className = "hud-mc-grid";
  for (let i = 0; i < BACKPACK_SLOTS; i++) {
    grid.append(createBackpackSlot(connection, rows[i] ?? null, state));
  }
  section.append(title, grid);
  return section;
}

function createBackpackSlot(
  connection: Connection,
  row: InventoryRow | null,
  state: InventoryGridState,
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "hud-mc-slot";
  if (!row) {
    btn.disabled = true;
    return btn;
  }
  const equipped = connection.weapon === row.id || Object.values(connection.armor ?? {}).includes(row.id);
  btn.dataset.selected = String(state.selectedItemId === row.id);
  btn.dataset.equipped = String(equipped);
  btn.draggable = true;
  btn.title = `${row.name} ×${row.quantity}`;
  btn.addEventListener("dragstart", (e) => e.dataTransfer?.setData("text/plain", row.id));
  btn.addEventListener("click", () => state.selectItem(state.selectedItemId === row.id ? null : row.id));
  btn.addEventListener("dblclick", () => triggerPrimaryAction(connection, row.id));
  populateSlotButton(btn, {
    itemId: row.id,
    qty: row.quantity,
    badge: row.boundSlot !== null ? `[${row.boundSlot + 1}]` : equipped ? "EQ" : "",
  });
  return btn;
}

function buildHotbarGridSection(connection: Connection, state: InventoryGridState): HTMLElement {
  const section = document.createElement("section");
  section.className = "hud-mc-hotbar-section";
  const title = document.createElement("div");
  title.className = "hud-mc-section-title";
  title.textContent = "Active Hotbar (1–9)";
  const grid = document.createElement("div");
  grid.className = "hud-mc-grid hud-mc-grid--hotbar";
  for (let slot = 0; slot < HOTBAR_SLOTS; slot++) {
    grid.append(createHotbarGridSlot(connection, slot, state));
  }
  section.append(title, grid);
  return section;
}

function createHotbarGridSlot(
  connection: Connection,
  slotIndex: number,
  state: InventoryGridState,
): HTMLButtonElement {
  const itemId = connection.hotbar[slotIndex] ?? null;
  const qty = hotbarQuantity(connection.inventory, itemId);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "hud-mc-slot hud-mc-slot--hotbar";
  btn.dataset.equipped = String(itemId !== null && connection.weapon === itemId);
  populateSlotButton(btn, { itemId, qty, badge: String(slotIndex + 1) });
  btn.addEventListener("click", () => {
    if (state.selectedItemId && isHotbarBindableItem(state.selectedItemId)) {
      assignAndEquipHotbarItem(connection, slotIndex, state.selectedItemId);
      return;
    }
    if (itemId) {
      if (isWeaponItem(itemId)) connection.equip(itemId);
      state.selectItem(itemId);
    }
  });
  btn.addEventListener("dragover", (e) => e.preventDefault());
  btn.addEventListener("drop", (e) => {
    e.preventDefault();
    const dropped = e.dataTransfer?.getData("text/plain")?.trim();
    if (dropped && isHotbarBindableItem(dropped)) assignAndEquipHotbarItem(connection, slotIndex, dropped);
  });
  return btn;
}

function assignAndEquipHotbarItem(connection: Connection, slotIndex: number, itemId: string): void {
  connection.assignSlot(slotIndex, itemId);
  if (isWeaponItem(itemId)) connection.equip(itemId);
}

function populateSlotButton(btn: HTMLButtonElement, input: { itemId: string | null; qty: number; badge: string }): void {
  if (input.badge) {
    const tag = document.createElement("span");
    tag.className = "hud-mc-slot__tag";
    tag.textContent = input.badge;
    btn.append(tag);
  }
  if (!input.itemId) return;
  const img = document.createElement("img");
  img.className = "hud-mc-slot__icon";
  img.src = itemIconDataUrl(input.itemId);
  img.alt = itemName(input.itemId);
  img.draggable = false;
  btn.append(img);
  if (input.qty > 1) {
    const count = document.createElement("span");
    count.className = "hud-mc-slot__count";
    count.textContent = `×${input.qty}`;
    btn.append(count);
  }
}

function triggerPrimaryAction(connection: Connection, itemId: string): void {
  if (isArmorItem(itemId)) connection.equip(itemId, itemArmorSlot(itemId) ?? undefined);
  else if (isWeaponItem(itemId)) connection.equip(itemId);
  else if (isConsumableItem(itemId)) connection.useItem(itemId);
}
