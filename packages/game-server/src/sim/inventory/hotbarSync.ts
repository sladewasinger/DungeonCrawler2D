/** Real-item Minecraft-style hotbar ownership, deduplication, and swap helpers. */
import type { PlayerSlot, SimState } from "../state/state.js";

function ownedQty(slot: PlayerSlot, defId: string): number {
  return slot.inventory.find((stack) => stack.item === defId)?.qty ?? 0;
}

/** Clears depleted or duplicate hotbar bindings and clears unowned weapon equipment. */
export function reconcileHotbar(
  sim: SimState,
  slot: PlayerSlot,
  persist = true,
): boolean {
  const changed = dedupeAndPruneHotbar(sim, slot);
  if (slot.weapon !== null && ownedQty(slot, slot.weapon) <= 0) {
    slot.weapon = null;
  }
  if (changed && persist) sim.store.recordHotbar(slot.stored, slot.hotbar);
  return changed;
}

function dedupeAndPruneHotbar(sim: SimState, slot: PlayerSlot): boolean {
  const seen = new Set<string>();
  let changed = false;
  for (let i = 0; i < slot.hotbar.length; i++) {
    const item = slot.hotbar[i] ?? null;
    if (!item) continue;
    const keep = sim.content.items.has(item) && ownedQty(slot, item) > 0 && !seen.has(item);
    if (keep) {
      seen.add(item);
      continue;
    }
    slot.hotbar[i] = null;
    changed = true;
  }
  return changed;
}

/** Immediately nulls depleted items from hotbar and equipped weapon without store coupling. */
export function pruneDepletedItemFromSlot(slot: PlayerSlot, defId: string): boolean {
  if (ownedQty(slot, defId) > 0) return false;
  let changed = false;
  for (let i = 0; i < slot.hotbar.length; i++) {
    if (slot.hotbar[i] !== defId) continue;
    slot.hotbar[i] = null;
    changed = true;
  }
  if (slot.weapon === defId) slot.weapon = null;
  return changed;
}

/** Assigns, swaps, or clears a hotbar slot while enforcing real item ownership. */
export function assignHotbarSlot(
  sim: SimState,
  slot: PlayerSlot,
  input: { readonly hotbarSlot: number; readonly item: string | null },
): void {
  const { hotbarSlot, item } = input;
  if (hotbarSlot < 0 || hotbarSlot >= slot.hotbar.length) return;
  if (item === null) return clearHotbarIndex(sim, slot, hotbarSlot);
  if (!sim.content.items.has(item) || ownedQty(slot, item) <= 0) return;
  placeOrSwapHotbarItem(sim, slot, { hotbarSlot, item });
}

function clearHotbarIndex(sim: SimState, slot: PlayerSlot, hotbarSlot: number): void {
  const prev = slot.hotbar[hotbarSlot] ?? null;
  slot.hotbar[hotbarSlot] = null;
  if (prev && slot.weapon === prev) slot.weapon = null;
  sim.store.recordHotbar(slot.stored, slot.hotbar);
}

function placeOrSwapHotbarItem(
  sim: SimState,
  slot: PlayerSlot,
  input: { readonly hotbarSlot: number; readonly item: string },
): void {
  const { hotbarSlot, item } = input;
  const existing = slot.hotbar.indexOf(item);
  if (existing === hotbarSlot) return;
  const displaced = slot.hotbar[hotbarSlot] ?? null;
  if (existing >= 0) slot.hotbar[existing] = displaced;
  else if (displaced && slot.weapon === displaced) slot.weapon = null;
  slot.hotbar[hotbarSlot] = item;
  reconcileHotbar(sim, slot, false);
  sim.store.recordHotbar(slot.stored, slot.hotbar);
}

/** Restores any owned items from the player's saved hotbar layout after respawn. */
export function restoreOwnedSavedHotbar(sim: SimState, slot: PlayerSlot): void {
  const saved = slot.stored.hotbar;
  if (!saved) return;
  slot.hotbar.fill(null);
  const limit = Math.min(slot.hotbar.length, saved.length);
  for (let i = 0; i < limit; i++) {
    const item = saved[i] ?? null;
    if (item && sim.content.items.has(item) && ownedQty(slot, item) > 0 && !slot.hotbar.includes(item)) {
      slot.hotbar[i] = item;
    }
  }
}
