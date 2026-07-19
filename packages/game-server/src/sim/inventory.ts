import { PICKUP_RANGE, TILE, type Entity } from "@dc2d/engine";
import { adjacentToTile, spawnItem } from "./helpers.js";
import type { PlayerSlot, SimState } from "./state.js";

/**
 * The unlimited inventory: one stack per item def, no capacity. The
 * hotbar holds BINDINGS (item defs), not items — using a bound slot
 * consumes from the inventory stack; bindings survive an empty stack
 * so refilling re-arms the same key. Weapons live in the equipment
 * slot, not the hotbar.
 */

/** Index of the stack holding `defId`, or -1. */
export function invIndex(slot: PlayerSlot, defId: string): number {
  return slot.inventory.findIndex((s) => s.item === defId);
}

export function invQty(slot: PlayerSlot, defId: string): number {
  const i = invIndex(slot, defId);
  // i >= 0 guarantees slot.inventory[i] exists (found by invIndex above).
  return i >= 0 ? slot.inventory[i]!.qty : 0;
}

/**
 * Add to the inventory (never fails — it's unlimited). The first
 * weapon auto-equips (bare hands → sword is never the wrong call);
 * hotbar bindings are the player's own — pickups never touch them
 * (bind from the inventory panel: click a row, press 1-9).
 */
export function invAdd(sim: SimState, slot: PlayerSlot, defId: string, qty: number): void {
  const i = invIndex(slot, defId);
  // i >= 0 guarantees slot.inventory[i] exists (found by invIndex above).
  if (i >= 0) slot.inventory[i]!.qty += qty;
  else slot.inventory.push({ item: defId, qty });

  const def = sim.content.items.get(defId);
  if (!def) return;
  if (def.weapon && slot.weapon === null) {
    slot.weapon = defId;
    slot.outbox.push({ t: "toast", msg: `Equipped ${def.name}` });
  }
}

/** Remove qty of a def; false if the stack is short. Prunes empty stacks. */
export function invRemove(slot: PlayerSlot, defId: string, qty: number): boolean {
  const i = invIndex(slot, defId);
  // Every slot.inventory[i] access below is guarded by the i < 0 check above.
  if (i < 0 || slot.inventory[i]!.qty < qty) return false;
  slot.inventory[i]!.qty -= qty;
  if (slot.inventory[i]!.qty <= 0) slot.inventory.splice(i, 1);
  return true;
}

/** Pick up the nearest ground item within range on the same level. */
export function doPickup(sim: SimState, slot: PlayerSlot): void {
  const body = slot.entity.body;
  let best: Entity | null = null;
  let bestDist = PICKUP_RANGE;
  for (const item of sim.items.values()) {
    // Same level only — no grabbing loot off a mesa top from below.
    if (Math.abs(item.body.z - body.z) > 1.5) continue;
    const d = Math.hypot(item.body.x - body.x, item.body.y - body.y);
    if (d <= bestDist) {
      bestDist = d;
      best = item;
    }
  }
  if (!best?.defId) return;
  invAdd(sim, slot, best.defId, best.qty);
  sim.items.delete(best.id);
  sim.exposure.delete(best.id);
}

/** Drop a whole stack by def (the binding stays, re-armed on repickup). */
export function doDrop(sim: SimState, slot: PlayerSlot, defId: string): void {
  const i = invIndex(slot, defId);
  if (i < 0) return;
  const stack = slot.inventory[i]!;
  spawnItem(sim, stack.item, slot.entity.body.x, slot.entity.body.y, stack.qty);
  slot.inventory.splice(i, 1);
  if (slot.weapon === defId) slot.weapon = null;
}

export function dropAllInventory(sim: SimState, slot: PlayerSlot): void {
  for (const stack of slot.inventory) {
    // Scatter a little so stacks are visible/lootable.
    const jx = (sim.rng.next() - 0.5) * 1.5;
    const jy = (sim.rng.next() - 0.5) * 1.5;
    spawnItem(sim, stack.item, slot.entity.body.x + jx, slot.entity.body.y + jy, stack.qty);
  }
  slot.inventory = [];
  slot.weapon = null;
}

export function doCraft(sim: SimState, slot: PlayerSlot, recipeId: string): void {
  const recipe = sim.content.recipes.get(recipeId);
  if (!recipe) return;
  const tileX = Math.floor(slot.entity.body.x);
  const tileY = Math.floor(slot.entity.body.y);
  if (!adjacentToTile(sim, tileX, tileY, TILE.CraftingTable)) {
    slot.outbox.push({ t: "toast", msg: "You need a crafting table" });
    return;
  }
  for (const input of recipe.inputs) {
    if (invQty(slot, input.item) < input.qty) {
      slot.outbox.push({ t: "toast", msg: `Missing ${input.item}` });
      return;
    }
  }
  for (const input of recipe.inputs) invRemove(slot, input.item, input.qty);
  invAdd(sim, slot, recipe.output.item, recipe.output.qty);
  slot.outbox.push({ t: "toast", msg: `Crafted ${recipe.output.item}` });
}

export function doStash(
  sim: SimState,
  slot: PlayerSlot,
  op: "put" | "take",
  index: number,
): void {
  const tileX = Math.floor(slot.entity.body.x);
  const tileY = Math.floor(slot.entity.body.y);
  if (!adjacentToTile(sim, tileX, tileY, TILE.Stash)) return;
  if (op === "put") {
    const stack = slot.inventory[index];
    if (!stack) return;
    const def = sim.content.items.get(stack.item);
    if (!def) return;
    if (sim.store.stashAdd(slot.stored, stack.item, stack.qty, def.maxStack)) {
      if (slot.weapon === stack.item) slot.weapon = null;
      slot.inventory.splice(index, 1);
    } else {
      slot.outbox.push({ t: "toast", msg: "Stash full" });
    }
  } else {
    const entry = sim.store.stashTake(slot.stored, index);
    if (!entry) return;
    invAdd(sim, slot, entry.item, entry.qty);
  }
  slot.outbox.push({ t: "stash", slots: slot.stored.stash.map((s) => ({ ...s })) });
}
