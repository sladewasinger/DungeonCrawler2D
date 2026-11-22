/** Builds the Minecraft-style 4-Armor + Quick-Craft + 3x9 Backpack + 1x9 Hotbar grid. */
import type { Connection } from "../../../net/connection/connection.js";
import { isArmorItem, isConsumableItem, isWeaponItem, itemArmorSlot, itemName } from "../../../ui/presentation/itemCatalog.js";
import { itemIconDataUrl } from "../../../ui/presentation/itemIcons.js";
import type { InventoryRow } from "../model/HudModel.js";
import { buildArmorAndStatsSection } from "./InventoryArmorStats.js";
import { buildSelectedInspector } from "./InventoryInspector.js";
import { readInventoryDragPayload, writeInventoryDragPayload } from "./inventoryDragPayload.js";
import { buildHotbarGridSection, type InventoryGridState } from "./InventoryHotbarGrid.js";
import { buildQuickCraftSection } from "./InventoryQuickCraft.js";

const BACKPACK_SLOTS = 27;

export type { InventoryGridState };

export function buildInventoryWorkspace(
  connection: Connection,
  rows: readonly InventoryRow[],
  state: InventoryGridState,
): HTMLElement {
  const root = document.createElement("div");
  root.className = "hud-mc-workspace";
  const topRow = document.createElement("div");
  topRow.className = "hud-mc-top";
  topRow.append(buildArmorAndStatsSection(connection, state), buildQuickCraftSection(connection));
  root.append(
    topRow,
    buildBackpackGridSection(connection, rows, state),
    buildSelectedInspector(connection, state),
    buildHotbarGridSection(connection, state),
  );
  return root;
}

function buildBackpackGridSection(
  connection: Connection,
  rows: readonly InventoryRow[],
  state: InventoryGridState,
): HTMLElement {
  const section = document.createElement("section");
  section.className = "hud-mc-backpack";
  const title = document.createElement("div");
  title.className = "hud-mc-section-title";
  title.textContent = "Backpack (3×9 · Drag or Tap Item, then Tap Hotbar/Armor)";
  const grid = document.createElement("div");
  grid.className = "hud-mc-grid";
  for (let i = 0; i < BACKPACK_SLOTS; i++) {
    grid.append(createBackpackSlot(connection, rows[i] ?? null, state));
  }
  bindBackpackDrop({ target: section, connection, state });
  section.append(title, grid);
  return section;
}

function bindBackpackDrop(input: {
  readonly target: HTMLElement;
  readonly connection: Connection;
  readonly state: InventoryGridState;
}): void {
  const { target, connection, state } = input;
  target.addEventListener("dragover", (e) => e.preventDefault());
  target.addEventListener("drop", (e) => {
    e.preventDefault();
    const payload = readInventoryDragPayload(e.dataTransfer);
    if (!payload) return;
    if (payload.source === "hotbar" && payload.fromSlot !== undefined) {
      connection.assignSlot(payload.fromSlot, null);
      state.selectItem(null);
      return;
    }
    if (payload.source === "armor" && payload.armorSlot) {
      connection.equip(null, payload.armorSlot);
      state.selectItem(null);
    }
  });
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
  btn.dataset.selected = String(state.selectedItemId === row.id);
  btn.draggable = true;
  btn.title = `${row.name} ×${row.quantity}`;
  btn.addEventListener("dragstart", (e) =>
    writeInventoryDragPayload(e.dataTransfer, { source: "backpack", itemId: row.id }));
  btn.addEventListener("click", () => state.selectItem(state.selectedItemId === row.id ? null : row.id));
  btn.addEventListener("dblclick", () => {
    triggerPrimaryAction(connection, row.id);
    state.selectItem(null);
  });
  populateBackpackSlotContent(btn, row);
  return btn;
}

function populateBackpackSlotContent(btn: HTMLButtonElement, row: InventoryRow): void {
  const img = document.createElement("img");
  img.className = "hud-mc-slot__icon";
  img.src = itemIconDataUrl(row.id);
  img.alt = itemName(row.id);
  img.draggable = false;
  btn.append(img);
  if (row.quantity <= 1) return;
  const count = document.createElement("span");
  count.className = "hud-mc-slot__count";
  count.textContent = `×${row.quantity}`;
  btn.append(count);
}

function triggerPrimaryAction(connection: Connection, itemId: string): void {
  if (isArmorItem(itemId)) connection.equip(itemId, itemArmorSlot(itemId) ?? undefined);
  else if (isWeaponItem(itemId)) connection.equip(itemId);
  else if (isConsumableItem(itemId)) connection.useItem(itemId);
}
