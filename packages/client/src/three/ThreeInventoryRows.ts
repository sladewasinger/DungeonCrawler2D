/** Builds inventory item rows while keeping authoritative item actions at the DOM edge. */
import type { Connection } from "../net/connection.js";
import { type ThreeInventoryRow, nextAvailableHotbarSlot } from "./ThreeHudModel.js";
import { HUD_MUTED, createHudButton } from "./ThreeHudStyles.js";

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
  row: ThreeInventoryRow,
): HTMLDivElement => {
  const actions = document.createElement("div");
  actions.style.cssText = "display:flex;gap:4px;flex-wrap:wrap";
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
  row: ThreeInventoryRow,
): HTMLDivElement => {
  const element = document.createElement("div");
  element.style.cssText =
    "padding:8px;border:1px solid #454960;background:rgba(24,25,39,.86)";
  const heading = document.createElement("div");
  heading.style.cssText =
    "display:flex;justify-content:space-between;gap:8px;font-weight:700";
  const binding = row.boundSlot === null ? "" : ` [${row.boundSlot + 1}]`;
  heading.append(
    document.createTextNode(`${row.name}${binding}`),
    document.createTextNode(`×${row.quantity}`),
  );
  const flavor = document.createElement("div");
  flavor.textContent = row.flavor ?? row.category;
  flavor.style.cssText =
    `color:${HUD_MUTED};font-size:10px;margin:4px 0 6px;overflow-wrap:anywhere`;
  element.append(heading, flavor, rowActions(connection, row));
  return element;
};
