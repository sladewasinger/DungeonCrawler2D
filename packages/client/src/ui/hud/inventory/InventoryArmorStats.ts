/** Renders the 4 Armor slots, player vitals summary, and selected item inspector bar. */
import {
  ARMOR_SLOTS,
  playerDamageMultiplierForLevel,
  type ArmorSlot,
} from "@dc2d/engine";
import type { Connection } from "../../../net/connection/connection.js";
import {
  isArmorItem,
  isConsumableItem,
  isWeaponItem,
  itemArmorDef,
  itemArmorSlot,
  itemFlavor,
  itemName,
} from "../../../ui/presentation/itemCatalog.js";
import {
  armorSlotSilhouetteDataUrl,
  itemIconDataUrl,
} from "../../../ui/presentation/itemIcons.js";
import { createHudButton } from "../styles/HudStyles.js";
import type { InventoryGridState } from "./InventoryGrid.js";

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
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "hud-mc-slot hud-mc-slot--armor";
  btn.dataset.armorSlot = slot;
  btn.dataset.occupied = String(Boolean(equippedId));
  btn.title = equippedId ? `${itemName(equippedId)} (Click to unequip)` : `${slot.toUpperCase()} Armor Slot`;

  const img = document.createElement("img");
  img.className = "hud-mc-slot__icon";
  img.src = equippedId ? itemIconDataUrl(equippedId) : armorSlotSilhouetteDataUrl(slot);
  img.alt = slot;
  const label = document.createElement("span");
  label.className = "hud-mc-slot__tag";
  label.textContent = slot.slice(0, 4).toUpperCase();
  btn.append(label, img);

  btn.addEventListener("click", () => {
    if (state.selectedItemId && itemArmorSlot(state.selectedItemId) === slot) {
      connection.equip(state.selectedItemId, slot);
      return;
    }
    if (equippedId) connection.equip(null, slot);
  });
  btn.addEventListener("dragover", (e) => e.preventDefault());
  btn.addEventListener("drop", (e) => {
    e.preventDefault();
    const itemId = e.dataTransfer?.getData("text/plain")?.trim();
    if (itemId && itemArmorSlot(itemId) === slot) connection.equip(itemId, slot);
  });
  return btn;
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

export function buildSelectedInspector(
  connection: Connection,
  state: InventoryGridState,
): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "hud-mc-inspector";
  const itemId = state.selectedItemId;
  const stack = itemId ? connection.inventory.find((s) => s.item === itemId) : undefined;
  if (!itemId || !stack) {
    bar.textContent = "Tip: Click/tap any item to inspect, use, equip, or tap a hotbar slot [1–9] to assign.";
    return bar;
  }
  const copy = document.createElement("div");
  copy.className = "hud-mc-inspector__copy";
  const title = document.createElement("strong");
  title.textContent = `${itemName(itemId)} ×${stack.qty}`;
  const flavor = document.createElement("span");
  flavor.textContent = itemFlavor(itemId) ?? "";
  copy.append(title, flavor);

  const actions = document.createElement("div");
  actions.className = "hud-inventory__actions";
  appendInspectorButtons(connection, itemId, actions);
  bar.append(copy, actions);
  return bar;
}

function appendInspectorButtons(
  connection: Connection,
  itemId: string,
  actions: HTMLElement,
): void {
  if (isWeaponItem(itemId)) {
    const equipped = connection.weapon === itemId;
    actions.append(createHudButton(equipped ? "unequip" : "equip hand", () => connection.equip(equipped ? null : itemId)));
  }
  if (isArmorItem(itemId)) {
    const slot = itemArmorSlot(itemId)!;
    const equipped = connection.armor?.[slot] === itemId;
    actions.append(createHudButton(equipped ? "unequip armor" : `wear (${slot})`, () => connection.equip(equipped ? null : itemId, slot)));
  }
  if (isConsumableItem(itemId)) {
    actions.append(createHudButton("use / heal", () => connection.useItem(itemId)));
  }
  actions.append(createHudButton("drop 1", () => connection.drop(itemId)));
}
