/**
 * Hotbar/throwable/panel-number-key logic — pure functions over InputState plus
 * the connection/panels/queries contracts, so it ports and tests without Phaser.
 */
import type { InputConnection, InputPanels, InputQueries, InputState, Keys, ThrowPreview } from "./state.js";

/** Current selected throwable slot, or null when no throwable is selected. */
export function activeThrowableSlot(state: InputState, conn: InputConnection, queries: InputQueries): number | null {
  if (state.selectedSlot === null) return null;
  const defId = conn.hotbar[state.selectedSlot];
  return defId && queries.isThrowable(defId) ? state.selectedSlot : null;
}

/** Builds the world-space throw preview from the active pointer, if any slot is armed. */
export function throwPreview(
  state: InputState,
  conn: InputConnection,
  queries: InputQueries,
  pointerWorld: { x: number; y: number },
): ThrowPreview | null {
  const slot = activeThrowableSlot(state, conn, queries);
  if (slot === null) return null;
  return { slot, targetX: pointerWorld.x, targetY: pointerWorld.y };
}

/** [1-9]/hotbar click selects a usable without consuming or throwing it. */
export function activateHotbar(state: InputState, conn: InputConnection, index: number): void {
  const defId = conn.hotbar[index];
  if (!defId) return;
  state.selectedSlot = state.selectedSlot === index ? null : index;
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
export function onNumberKey(
  state: InputState,
  conn: InputConnection,
  panels: InputPanels,
  queries: InputQueries,
  keys: Keys,
  n: number,
): void {
  if (panels.inventoryOpen && panels.selectedInventoryItem) {
    conn.assignSlot(n - 1, panels.selectedInventoryItem);
    return;
  }
  if (panels.craftOpen && queries.isCraftTableNearby(conn)) {
    const recipeId = queries.recipeIdAt(n - 1);
    if (recipeId) conn.craft(recipeId);
    return;
  }
  if (panels.stashOpen && conn.stash && queries.isStashNearby(conn)) {
    handleStashNumberKey(conn, keys, n);
    return;
  }
  activateHotbar(state, conn, n - 1);
}
