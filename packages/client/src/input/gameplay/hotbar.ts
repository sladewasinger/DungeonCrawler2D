/**
 * Hotbar/throwable/panel-number-key logic — pure functions over InputState plus
 * the connection/panels/queries contracts, so it ports and tests without Phaser.
 */
import { isConsumableItem, isThrowableItem, isWeaponItem } from "../../ui/presentation/itemCatalog.js";
import type { InputConnection, InputPanels, InputQueries, InputState, Keys } from "../controls/state.js";

export interface NumberKeyRequest {
  readonly state: InputState;
  readonly conn: InputConnection;
  readonly panels: InputPanels;
  readonly queries: InputQueries;
  readonly keys: Keys;
  readonly number: number;
}

interface PanelNumberRequest {
  readonly conn: InputConnection;
  readonly panels: InputPanels;
  readonly queries: InputQueries;
  readonly keys: Keys;
  readonly number: number;
}

/** Current selected throwable slot, or null when no throwable is selected. */
export function activeThrowableSlot(state: InputState, conn: InputConnection, queries: InputQueries): number | null {
  if (state.selectedSlot === null) return null;
  const defId = conn.hotbar[state.selectedSlot];
  return defId && queries.isThrowable(defId) ? state.selectedSlot : null;
}

/** [1-9]/hotbar click selects a slot and holds its item in the active hand. */
export function activateHotbar(state: InputState, conn: InputConnection, index: number): void {
  const defId = conn.hotbar[index];
  const owned = Boolean(defId && conn.inventory.some((stack) => stack.item === defId && stack.qty > 0));
  if (!defId || !owned || state.selectedSlot === index) {
    state.selectedSlot = null;
    if (conn.weapon !== null) conn.equip(null);
    return;
  }
  state.selectedSlot = index;
  syncActiveHandEquipment(defId, conn);
}

function syncActiveHandEquipment(defId: string, conn: InputConnection): void {
  if (isWeaponItem(defId)) {
    if (conn.weapon !== defId) conn.equip(defId);
  } else if ((isConsumableItem(defId) || isThrowableItem(defId)) && conn.weapon !== null) {
    conn.equip(null);
  }
}

/** Shift+number puts the hotbar-bound item into the stash; a plain number takes from it. */
function handleStashNumberKey(conn: InputConnection, keys: Keys, n: number): void {
  if (!keys.SHIFT.isDown) {
    conn.stashOp("take", n - 1);
    return;
  }
  const defId = conn.hotbar[n - 1];
  const inventoryIndex = defId ? conn.inventory.findIndex((stack) => stack.item === defId) : -1;
  if (inventoryIndex >= 0) conn.stashOp("put", inventoryIndex);
}

/** Numbers act on the open panel first, then select their matching hotbar slot. */
export function onNumberKey(request: NumberKeyRequest): void {
  const { state, conn, panels, queries, keys, number: n } = request;
  const panelRequest = { conn, panels, queries, keys, number: n };
  if (assignSelectedInventoryItem(panelRequest)) return;
  if (craftSelectedRecipe(panelRequest)) return;
  if (useStashNumberKey(panelRequest)) return;
  activateHotbar(state, conn, n - 1);
}

function assignSelectedInventoryItem({ conn, panels, number: n }: PanelNumberRequest): boolean {
  if (panels.inventoryOpen && panels.selectedInventoryItem) {
    conn.assignSlot(n - 1, panels.selectedInventoryItem);
    return true;
  }
  return false;
}

function craftSelectedRecipe({ conn, panels, queries, number: n }: PanelNumberRequest): boolean {
  if (panels.craftOpen && queries.isCraftTableNearby(conn)) {
    const recipeId = queries.recipeIdAt(n - 1);
    if (recipeId) conn.craft(recipeId);
    return true;
  }
  return false;
}

function useStashNumberKey({ conn, panels, queries, keys, number: n }: PanelNumberRequest): boolean {
  if (panels.stashOpen && conn.stash && queries.isStashNearby(conn)) {
    handleStashNumberKey(conn, keys, n);
    return true;
  }
  return false;
}
