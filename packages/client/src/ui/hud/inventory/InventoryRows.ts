/** Builds inventory item rows while keeping authoritative item actions at the DOM edge. */
import type { Connection } from "../../../net/connection/connection.js";
import { type InventoryRow, nextAvailableHotbarSlot } from "../model/HudModel.js";
import { createHudButton } from "../styles/HudStyles.js";
import { createHudTemplate, requireHudElement } from "../styles/hudTemplate.js";

const equipButton = (
  connection: Connection,
  itemId: string,
): HTMLButtonElement => {
  const equipped = connection.weapon === itemId;
  return createHudButton(equipped ? "unequip" : "equip", () => {
    connection.equip(equipped ? null : itemId);
  });
};

const hotbarButton = (
  connection: Connection,
  itemId: string,
): HTMLButtonElement => {
  const existing = connection.hotbar.indexOf(itemId);
  const label = existing >= 0 ? `bound [${existing + 1}]` : "bind next slot";
  return createHudButton(label, () => {
    const slot = nextAvailableHotbarSlot(connection.hotbar, itemId);
    if (slot < 0) connection.pushToast("The hotbar is full.");
    else connection.assignSlot(slot, itemId);
  });
};

const rowActions = (
  connection: Connection,
  row: InventoryRow,
): HTMLDivElement => {
  const actions = createHudTemplate<HTMLDivElement>("hud-inventory-actions-template");
  if (row.canEquip) actions.append(equipButton(connection, row.id));
  if (row.canUse) {
    actions.append(createHudButton("use", () => connection.useItem(row.id)));
  }
  if (row.canHotbar) actions.append(hotbarButton(connection, row.id));
  actions.append(createHudButton("drop one", () => connection.drop(row.id)));
  return actions;
};

export const createInventoryRow = (
  connection: Connection,
  row: InventoryRow,
): HTMLDivElement => {
  const element = createHudTemplate<HTMLDivElement>("hud-inventory-row-template");
  const name = requireHudElement<HTMLElement>(element, "[data-hud-inventory-name]");
  const quantity = requireHudElement<HTMLElement>(element, "[data-hud-inventory-quantity]");
  const flavor = requireHudElement<HTMLElement>(element, "[data-hud-inventory-flavor]");
  name.textContent = row.name;
  const binding = row.boundSlot === null ? "" : ` [${row.boundSlot + 1}]`;
  name.textContent += binding;
  quantity.textContent = `×${row.quantity}`;
  flavor.textContent = row.flavor ?? row.category;
  requireHudElement(element, "[data-hud-inventory-actions]").replaceChildren(...rowActions(connection, row).children);
  return element;
};
