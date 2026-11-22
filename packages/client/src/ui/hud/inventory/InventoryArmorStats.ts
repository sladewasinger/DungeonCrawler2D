/** Renders the 4 Armor slots and player vitals summary inside the inventory modal. */
import {
  ARMOR_SLOTS,
  playerDamageMultiplierForLevel,
  type ArmorSlot,
} from "@dc2d/engine";
import type { Connection } from "../../../net/connection/connection.js";
import { itemArmorDef, itemArmorSlot, itemName } from "../../../ui/presentation/itemCatalog.js";
import { armorSlotSilhouetteDataUrl, itemIconDataUrl } from "../../../ui/presentation/itemIcons.js";
import { readInventoryDragPayload, writeInventoryDragPayload } from "./inventoryDragPayload.js";
import type { InventoryGridState } from "./InventoryHotbarGrid.js";

export function buildArmorAndStatsSection(
  connection: Connection,
  state: InventoryGridState,
): HTMLElement {
  const section = document.createElement("section");
  section.className = "hud-mc-armor-card";
  const title = document.createElement("div");
  title.className = "hud-mc-section-title";
  title.textContent = "Armor & Vitals";

  const row = document.createElement("div");
  row.className = "hud-mc-armor-row";
  const slotsWrap = document.createElement("div");
  slotsWrap.className = "hud-mc-armor-slots";
  for (const slot of ARMOR_SLOTS) {
    slotsWrap.append(createArmorSlotButton(connection, slot, state));
  }
  row.append(slotsWrap, buildStatsSummary(connection));
  section.append(title, row);
  return section;
}

function createArmorSlotButton(
  connection: Connection,
  slot: ArmorSlot,
  state: InventoryGridState,
): HTMLButtonElement {
  const equippedId = connection.armor?.[slot] ?? null;
  const btn = createArmorElement(slot, equippedId);
  if (equippedId) {
    btn.draggable = true;
    btn.addEventListener("dragstart", (e) =>
      writeInventoryDragPayload(e.dataTransfer, { source: "armor", itemId: equippedId, armorSlot: slot }));
  }
  bindArmorInteractions({ btn, connection, slot, equippedId, state });
  return btn;
}

function createArmorElement(slot: ArmorSlot, equippedId: string | null): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "hud-mc-slot hud-mc-slot--armor";
  btn.dataset.armorSlot = slot;
  btn.dataset.occupied = String(Boolean(equippedId));
  btn.title = equippedId ? `${itemName(equippedId)} (Click or drag to backpack)` : `${slot.toUpperCase()} Armor Slot`;
  const img = document.createElement("img");
  img.className = "hud-mc-slot__icon";
  img.src = equippedId ? itemIconDataUrl(equippedId) : armorSlotSilhouetteDataUrl(slot);
  img.alt = slot;
  img.draggable = false;
  const label = document.createElement("span");
  label.className = "hud-mc-slot__tag";
  label.textContent = slot.slice(0, 4).toUpperCase();
  btn.append(label, img);
  return btn;
}

function bindArmorInteractions(input: {
  readonly btn: HTMLButtonElement;
  readonly connection: Connection;
  readonly slot: ArmorSlot;
  readonly equippedId: string | null;
  readonly state: InventoryGridState;
}): void {
  const { btn, connection, slot, equippedId, state } = input;
  btn.addEventListener("click", () => {
    if (state.selectedItemId && itemArmorSlot(state.selectedItemId) === slot) {
      equipArmorFromInventory(connection, slot, state.selectedItemId);
      state.selectItem(null);
      return;
    }
    if (equippedId) {
      connection.equip(null, slot);
      state.selectItem(null);
    }
  });
  btn.addEventListener("dragover", (e) => e.preventDefault());
  btn.addEventListener("drop", (e) => {
    e.preventDefault();
    const payload = readInventoryDragPayload(e.dataTransfer);
    if (!payload || itemArmorSlot(payload.itemId) !== slot) return;
    equipArmorFromInventory(connection, slot, payload.itemId);
    state.selectItem(null);
  });
}

export function equipArmorFromInventory(connection: Connection, slot: ArmorSlot, itemId: string): void {
  const hotbarIndex = connection.hotbar.indexOf(itemId);
  if (hotbarIndex >= 0) connection.assignSlot(hotbarIndex, null);
  connection.equip(itemId, slot);
}

function buildStatsSummary(connection: Connection): HTMLElement {
  const box = document.createElement("div");
  box.className = "hud-mc-stats";
  const dmgMult = Math.round(playerDamageMultiplierForLevel(connection.charLevel) * 100);
  let dr = 0;
  for (const key of ARMOR_SLOTS) {
    dr += itemArmorDef(connection.armor?.[key] ?? null)?.damageReduction ?? 0;
  }
  const lines = [
    `Lv ${connection.charLevel} (${dmgMult}% ATK)`,
    `HP ${Math.ceil(connection.hp)} / ${connection.maxHp}`,
    `STA ${Math.round(connection.stamina)} / ${connection.maxStamina}`,
    `Armor ${Math.round(dr * 100)}% DR`,
    `Hand: ${connection.weapon ? itemName(connection.weapon) : "Fists"}`,
  ];
  for (const text of lines) {
    const line = document.createElement("div");
    line.textContent = text;
    box.append(line);
  }
  return box;
}
