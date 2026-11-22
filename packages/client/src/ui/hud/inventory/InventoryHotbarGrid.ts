/** Builds the 1x9 Minecraft-style hotbar grid inside the inventory modal. */
import type { Connection } from "../../../net/connection/connection.js";
import { itemName } from "../../../ui/presentation/itemCatalog.js";
import { itemIconDataUrl } from "../../../ui/presentation/itemIcons.js";
import { hotbarQuantity } from "../model/HudModel.js";
import { readInventoryDragPayload, writeInventoryDragPayload } from "./inventoryDragPayload.js";

const HOTBAR_SLOTS = 9;

export interface InventoryGridState {
  selectedItemId: string | null;
  selectItem(itemId: string | null): void;
}

export function buildHotbarGridSection(
  connection: Connection,
  state: InventoryGridState,
): HTMLElement {
  const section = document.createElement("section");
  section.className = "hud-mc-hotbar-section";
  const title = document.createElement("div");
  title.className = "hud-mc-section-title";
  title.textContent = "Hotbar (1–9 · Drag to Reorder, × or Drag to Backpack to Move Back)";
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
): HTMLElement {
  const rawId = connection.hotbar[slotIndex] ?? null;
  const qty = hotbarQuantity(connection.inventory, rawId);
  const itemId = rawId && qty > 0 ? rawId : null;
  const wrap = document.createElement("div");
  wrap.className = "hud-mc-slot-wrap";
  wrap.dataset.selected = String(itemId !== null && state.selectedItemId === itemId);
  wrap.append(createSlotButton({ connection, slotIndex, itemId, qty, state }));
  if (itemId) wrap.append(createClearButton(connection, slotIndex, state));
  bindHotbarDrop(wrap, { connection, slotIndex, state });
  return wrap;
}

interface SlotControlContext {
  readonly connection: Connection;
  readonly slotIndex: number;
  readonly itemId: string | null;
  readonly qty: number;
  readonly state: InventoryGridState;
}

function createSlotButton(ctx: SlotControlContext): HTMLButtonElement {
  const { connection, slotIndex, itemId, qty, state } = ctx;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "hud-mc-slot hud-mc-slot--hotbar";
  btn.dataset.selected = String(itemId !== null && state.selectedItemId === itemId);
  btn.title = itemId ? `${itemName(itemId)} ×${qty} (Right-click to move to backpack)` : `Empty Hotbar Slot ${slotIndex + 1}`;
  populateHotbarSlotContent(btn, { itemId, qty, badge: String(slotIndex + 1) });
  if (itemId) bindOccupiedSlotEvents(btn, { connection, slotIndex, itemId, state });
  btn.addEventListener("click", () => handleHotbarClick(ctx));
  return btn;
}

function bindOccupiedSlotEvents(
  btn: HTMLButtonElement,
  ctx: Omit<SlotControlContext, "qty"> & { readonly itemId: string },
): void {
  btn.draggable = true;
  btn.addEventListener("dragstart", (e) =>
    writeInventoryDragPayload(e.dataTransfer, { source: "hotbar", itemId: ctx.itemId, fromSlot: ctx.slotIndex }));
  btn.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    moveToBackpack(ctx.connection, ctx.slotIndex, ctx.state);
  });
}

function handleHotbarClick({ connection, slotIndex, itemId, state }: SlotControlContext): void {
  if (!state.selectedItemId) {
    if (itemId) state.selectItem(itemId);
    return;
  }
  if (state.selectedItemId === itemId) state.selectItem(null);
  else {
    connection.assignSlot(slotIndex, state.selectedItemId);
    state.selectItem(null);
  }
}

function createClearButton(
  connection: Connection,
  slotIndex: number,
  state: InventoryGridState,
): HTMLButtonElement {
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "hud-mc-slot__clear";
  clear.textContent = "×";
  clear.title = "Move to backpack";
  clear.setAttribute("aria-label", "Move to backpack");
  clear.addEventListener("click", (e) => {
    e.stopPropagation();
    moveToBackpack(connection, slotIndex, state);
  });
  return clear;
}

function moveToBackpack(connection: Connection, slotIndex: number, state: InventoryGridState): void {
  connection.assignSlot(slotIndex, null);
  state.selectItem(null);
}

function bindHotbarDrop(
  target: HTMLElement,
  ctx: { readonly connection: Connection; readonly slotIndex: number; readonly state: InventoryGridState },
): void {
  target.addEventListener("dragover", (e) => e.preventDefault());
  target.addEventListener("drop", (e) => {
    e.preventDefault();
    const payload = readInventoryDragPayload(e.dataTransfer);
    if (!payload) return;
    if (payload.source === "armor" && payload.armorSlot) ctx.connection.equip(null, payload.armorSlot);
    ctx.connection.assignSlot(ctx.slotIndex, payload.itemId);
    ctx.state.selectItem(null);
  });
}

function populateHotbarSlotContent(
  btn: HTMLButtonElement,
  input: { itemId: string | null; qty: number; badge: string },
): void {
  const tag = document.createElement("span");
  tag.className = "hud-mc-slot__tag";
  tag.textContent = input.badge;
  btn.append(tag);
  if (!input.itemId) return;
  const img = document.createElement("img");
  img.className = "hud-mc-slot__icon";
  img.src = itemIconDataUrl(input.itemId);
  img.alt = itemName(input.itemId);
  img.draggable = false;
  btn.append(img);
  if (input.qty <= 1) return;
  const count = document.createElement("span");
  count.className = "hud-mc-slot__count";
  count.textContent = `×${input.qty}`;
  btn.append(count);
}
