import { PICKUP_RANGE, TILE, type Entity } from "@dc2d/engine";
import { adjacentToTile, spawnItem } from "./helpers";
import type { PlayerSlot, SimState } from "./state";

/** Inventory, pickup/drop, crafting, and stash operations. */

/** Returns leftover quantity that didn't fit. */
export function addToInventory(
  sim: SimState,
  slot: PlayerSlot,
  defId: string,
  qty: number,
): number {
  const def = sim.content.items.get(defId);
  if (!def) return qty;
  let remaining = qty;
  for (let i = 0; i < slot.inventory.length && remaining > 0; i++) {
    const s = slot.inventory[i];
    if (s && s.item === defId && s.qty < def.maxStack) {
      const take = Math.min(def.maxStack - s.qty, remaining);
      s.qty += take;
      remaining -= take;
    }
  }
  for (let i = 0; i < slot.inventory.length && remaining > 0; i++) {
    if (slot.inventory[i] === null) {
      const take = Math.min(def.maxStack, remaining);
      slot.inventory[i] = { item: defId, qty: take };
      remaining -= take;
    }
  }
  return remaining;
}

export function consumeFromSlot(slot: PlayerSlot, index: number): void {
  const inv = slot.inventory[index];
  if (!inv) return;
  inv.qty--;
  if (inv.qty <= 0) slot.inventory[index] = null;
}

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
  const leftover = addToInventory(sim, slot, best.defId, best.qty);
  if (leftover === 0) {
    sim.items.delete(best.id);
    sim.exposure.delete(best.id);
  } else if (leftover < best.qty) {
    best.qty = leftover;
  } else {
    slot.outbox.push({ t: "toast", msg: "Inventory full" });
  }
}

export function doDrop(sim: SimState, slot: PlayerSlot, index: number): void {
  const inv = slot.inventory[index];
  if (!inv) return;
  slot.inventory[index] = null;
  spawnItem(sim, inv.item, slot.entity.body.x, slot.entity.body.y, inv.qty);
}

export function dropAllInventory(sim: SimState, slot: PlayerSlot): void {
  for (let i = 0; i < slot.inventory.length; i++) {
    const inv = slot.inventory[i];
    if (!inv) continue;
    slot.inventory[i] = null;
    // Scatter a little so stacks are visible/lootable.
    const jx = (sim.rng.next() - 0.5) * 1.5;
    const jy = (sim.rng.next() - 0.5) * 1.5;
    spawnItem(sim, inv.item, slot.entity.body.x + jx, slot.entity.body.y + jy, inv.qty);
  }
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
  // Verify inputs.
  for (const input of recipe.inputs) {
    let have = 0;
    for (const s of slot.inventory) if (s?.item === input.item) have += s.qty;
    if (have < input.qty) {
      slot.outbox.push({ t: "toast", msg: `Missing ${input.item}` });
      return;
    }
  }
  // Consume.
  for (const input of recipe.inputs) {
    let need = input.qty;
    for (let i = 0; i < slot.inventory.length && need > 0; i++) {
      const s = slot.inventory[i];
      if (!s || s.item !== input.item) continue;
      const take = Math.min(s.qty, need);
      s.qty -= take;
      need -= take;
      if (s.qty <= 0) slot.inventory[i] = null;
    }
  }
  const leftover = addToInventory(sim, slot, recipe.output.item, recipe.output.qty);
  if (leftover > 0) {
    spawnItem(sim, recipe.output.item, slot.entity.body.x, slot.entity.body.y, leftover);
  }
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
    const inv = slot.inventory[index];
    if (!inv) return;
    const def = sim.content.items.get(inv.item);
    if (!def) return;
    if (sim.store.stashAdd(slot.stored, inv.item, inv.qty, def.maxStack)) {
      slot.inventory[index] = null;
    } else {
      slot.outbox.push({ t: "toast", msg: "Stash full" });
    }
  } else {
    const entry = sim.store.stashTake(slot.stored, index);
    if (!entry) return;
    const leftover = addToInventory(sim, slot, entry.item, entry.qty);
    if (leftover > 0) {
      const def = sim.content.items.get(entry.item);
      sim.store.stashAdd(slot.stored, entry.item, leftover, def?.maxStack ?? 1);
      if (leftover === entry.qty) slot.outbox.push({ t: "toast", msg: "Inventory full" });
    }
  }
  slot.outbox.push({ t: "stash", slots: slot.stored.stash.map((s) => ({ ...s })) });
}
