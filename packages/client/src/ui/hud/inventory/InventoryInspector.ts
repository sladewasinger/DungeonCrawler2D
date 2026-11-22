/** Renders the selected item inspector bar and quick transfer/equip actions. */
import { isArmorItem, isConsumableItem, isWeaponItem, itemArmorSlot, itemFlavor, itemName } from "../../../ui/presentation/itemCatalog.js";
import type { Connection } from "../../../net/connection/connection.js";
import { createHudButton } from "../styles/HudStyles.js";
import { equipArmorFromInventory } from "./InventoryArmorStats.js";
import type { InventoryGridState } from "./InventoryHotbarGrid.js";

export function buildSelectedInspector(
  connection: Connection,
  state: InventoryGridState,
): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "hud-mc-inspector";
  const itemId = state.selectedItemId;
  const stack = itemId ? connection.inventory.find((s) => s.item === itemId && s.qty > 0) : undefined;
  if (!itemId || !stack) {
    bar.textContent = "Tip: Drag items between Backpack, Hotbar [1–9], and Armor slots, or tap an item to inspect.";
    return bar;
  }
  const copy = createInspectorCopy(itemId, stack.qty);
  const actions = document.createElement("div");
  actions.className = "hud-inventory__actions";
  appendInspectorButtons({ connection, itemId, qty: stack.qty, actions, state });
  bar.append(copy, actions);
  return bar;
}

function createInspectorCopy(itemId: string, qty: number): HTMLElement {
  const copy = document.createElement("div");
  copy.className = "hud-mc-inspector__copy";
  const title = document.createElement("strong");
  title.textContent = `${itemName(itemId)} ×${qty}`;
  const flavor = document.createElement("span");
  flavor.textContent = itemFlavor(itemId) ?? "";
  copy.append(title, flavor);
  return copy;
}

function appendInspectorButtons(input: {
  readonly connection: Connection;
  readonly itemId: string;
  readonly qty: number;
  readonly actions: HTMLElement;
  readonly state: InventoryGridState;
}): void {
  const { connection, itemId, qty, actions, state } = input;
  appendHotbarMoveButton({ connection, itemId, actions, state });
  appendEquipmentButtons({ connection, itemId, actions, state });
  if (isConsumableItem(itemId)) {
    actions.append(createHudButton("Use / Heal", () => {
      connection.useItem(itemId);
      if (qty <= 1) state.selectItem(null);
    }));
  }
  actions.append(createHudButton("Drop 1", () => {
    connection.drop(itemId);
    if (qty <= 1) state.selectItem(null);
  }));
}

function appendHotbarMoveButton(input: {
  readonly connection: Connection;
  readonly itemId: string;
  readonly actions: HTMLElement;
  readonly state: InventoryGridState;
}): void {
  const { connection, itemId, actions, state } = input;
  const boundSlot = connection.hotbar.indexOf(itemId);
  if (boundSlot >= 0) {
    actions.append(createHudButton("Move to Backpack", () => {
      connection.assignSlot(boundSlot, null);
      state.selectItem(null);
    }));
    return;
  }
  const openSlot = connection.hotbar.findIndex((entry) => entry === null);
  if (openSlot < 0) return;
  actions.append(createHudButton(`Move to Hotbar [${openSlot + 1}]`, () => {
    connection.assignSlot(openSlot, itemId);
    state.selectItem(null);
  }));
}

function appendEquipmentButtons(input: {
  readonly connection: Connection;
  readonly itemId: string;
  readonly actions: HTMLElement;
  readonly state: InventoryGridState;
}): void {
  const { connection, itemId, actions, state } = input;
  if (isWeaponItem(itemId)) {
    const equipped = connection.weapon === itemId;
    actions.append(createHudButton(equipped ? "Unequip Hand" : "Hold in Hand", () =>
      connection.equip(equipped ? null : itemId)));
  }
  if (!isArmorItem(itemId)) return;
  const slot = itemArmorSlot(itemId)!;
  const equipped = connection.armor?.[slot] === itemId;
  actions.append(createHudButton(equipped ? "Unequip Armor" : `Wear (${slot})`, () => {
    if (equipped) connection.equip(null, slot);
    else equipArmorFromInventory(connection, slot, itemId);
    state.selectItem(null);
  }));
}
