/**
 * Hotbar/throwable/panel-number-key logic — pure functions over InputState plus
 * the connection/panels/queries contracts, so it ports and tests without Phaser.
 */
import type { InputConnection, InputPanels, InputQueries, InputState, Keys, ThrowPreview } from "./state.js";

/** Current armed-throwable preview, or null when no throwable is selected. */
export function activeThrowableSlot(state: InputState, conn: InputConnection, queries: InputQueries): number | null {
  if (state.selectedThrowable === null) return null;
  const defId = conn.hotbar[state.selectedThrowable];
  if (!defId || !queries.isThrowable(defId)) {
    state.selectedThrowable = null;
    return null;
  }
  return state.selectedThrowable;
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

/** [1-9]/hotbar click: arms a throwable or fires USE immediately for consumables/gear. */
export function activateHotbar(state: InputState, conn: InputConnection, queries: InputQueries, index: number): void {
  const defId = conn.hotbar[index];
  if (!defId) return;
  if (queries.isThrowable(defId)) {
    state.selectedThrowable = state.selectedThrowable === index ? null : index;
  } else {
    conn.useSlot(index);
  }
}

/** Numbers act on the open panel first (craft recipe / stash slot), then fall back to hotbar USE. */
export function onNumberKey(
  state: InputState,
  conn: InputConnection,
  panels: InputPanels,
  queries: InputQueries,
  keys: Keys,
  n: number,
): void {
  if (panels.craftOpen && queries.isCraftTableNearby(conn)) {
    const recipeId = queries.recipeIdAt(n - 1);
    if (recipeId) conn.craft(recipeId);
    return;
  }
  if (panels.stashOpen && conn.stash && queries.isStashNearby(conn)) {
    if (keys.SHIFT.isDown) {
      const defId = conn.hotbar[n - 1];
      const inventoryIndex = defId ? conn.inventory.findIndex((stack) => stack.item === defId) : -1;
      if (inventoryIndex >= 0) conn.stashOp("put", inventoryIndex);
    } else {
      conn.stashOp("take", n - 1);
    }
    return;
  }
  activateHotbar(state, conn, queries, n - 1);
}
