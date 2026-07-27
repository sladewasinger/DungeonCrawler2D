import { PICKUP_RANGE, findWorldInteractionTarget, type Entity } from "@dc2d/engine";
import { spawnItem } from "./helpers.js";
export { ensureStarterKit, grantRespawnKit } from "./inventory/starterKit.js";
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
export function invAdd(sim: SimState, slot: PlayerSlot, ...[defId, qty]: [string, number]): void {
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

function nearestPlacedTorch(sim: SimState, body: Entity["body"], maxDistance: number): Entity | null {
  let best: Entity | null = null;
  let bestDistance = maxDistance;
  for (const torch of sim.torches.values()) {
    if (torch.torchState !== "placed" || Math.abs(torch.body.z - body.z) > 1.5) continue;
    const distance = Math.hypot(torch.body.x - body.x, torch.body.y - body.y);
    if (distance <= bestDistance) {
      best = torch;
      bestDistance = distance;
    }
  }
  return best;
}

/** Pick up the nearest ground item or still-burning placed torch on the same level. */
export function doPickup(sim: SimState, slot: PlayerSlot): void {
  const body = slot.entity.body;
  const best = nearestPlacedTorch(sim, body, nearestItemDistance(sim, body)) ?? nearestGroundItem(sim, body);
  if (!best) return;
  pickUpEntity(sim, slot, best);
}

function nearestGroundItem(sim: SimState, body: Entity["body"]): Entity | null {
  return nearestEntity([...sim.items.values()], body, PICKUP_RANGE);
}

function nearestItemDistance(sim: SimState, body: Entity["body"]): number {
  const item = nearestGroundItem(sim, body);
  return item ? Math.hypot(item.body.x - body.x, item.body.y - body.y) : PICKUP_RANGE;
}

function nearestEntity(items: Entity[], body: Entity["body"], maxDistance: number): Entity | null {
  let best: Entity | null = null;
  let bestDistance = maxDistance;
  for (const item of items) {
    const distance = entityDistanceAtLevel(item, body);
    if (distance === null || distance > bestDistance) continue;
    best = item;
    bestDistance = distance;
  }
  return best;
}

function entityDistanceAtLevel(entity: Entity, body: Entity["body"]): number | null {
  if (Math.abs(entity.body.z - body.z) > 1.5) return null;
  return Math.hypot(entity.body.x - body.x, entity.body.y - body.y);
}

function pickUpEntity(sim: SimState, slot: PlayerSlot, entity: Entity): void {
  if (entity.kind === "torch" && entity.torchState === "placed") return pickUpTorch(sim, slot, entity);
  if (!entity.defId) return;
  invAdd(sim, slot, entity.defId, entity.qty);
  sim.items.delete(entity.id);
  sim.exposure.delete(entity.id);
}

function pickUpTorch(sim: SimState, slot: PlayerSlot, torch: Entity): void {
  sim.torches.delete(torch.id);
  invAdd(sim, slot, "torch", 1);
}

/** Drop one item by def; equipment clears only when its final copy leaves. */
export function doDrop(sim: SimState, slot: PlayerSlot, defId: string): void {
  if (!invRemove(slot, defId, 1)) return;
  spawnItem(sim, { defId, x: slot.entity.body.x, y: slot.entity.body.y, qty: 1 });
  if (slot.weapon === defId && invQty(slot, defId) === 0) slot.weapon = null;
}

export function dropAllInventory(sim: SimState, slot: PlayerSlot): void {
  for (const stack of slot.inventory) {
    // Scatter a little so stacks are visible/lootable.
    const jx = (sim.rng.next() - 0.5) * 1.5;
    const jy = (sim.rng.next() - 0.5) * 1.5;
    spawnItem(sim, { defId: stack.item, x: slot.entity.body.x + jx, y: slot.entity.body.y + jy, qty: stack.qty });
  }
  slot.inventory = [];
  slot.weapon = null;
}

export function doCraft(sim: SimState, slot: PlayerSlot, recipeId: string): void {
  const recipe = sim.content.recipes.get(recipeId);
  if (!recipe) return;
  const body = slot.entity.body;
  if (!findWorldInteractionTarget({ world: sim.world, x: body.x, y: body.y, kind: "craft" })) {
    slot.outbox.push({ t: "toast", msg: "You need a crafting table" });
    return;
  }
  const missing = recipe.inputs.find((input) => invQty(slot, input.item) < input.qty);
  if (missing) return void slot.outbox.push({ t: "toast", msg: `Missing ${missing.item}` });
  for (const input of recipe.inputs) invRemove(slot, input.item, input.qty);
  invAdd(sim, slot, recipe.output.item, recipe.output.qty);
  sim.store.recordCraft(slot.stored, recipe.id);
  slot.outbox.push({ t: "toast", msg: `Crafted ${recipe.output.item}` });
}

export function doStash(sim: SimState, slot: PlayerSlot, request: { op: "put" | "take"; index: number }): void {
  const body = slot.entity.body;
  if (!findWorldInteractionTarget({ world: sim.world, x: body.x, y: body.y, kind: "stash" })) return;
  if (request.op === "put") stashInventory(sim, slot, request.index);
  else unstashInventory(sim, slot, request.index);
  slot.outbox.push({ t: "stash", slots: slot.stored.stash.map((s) => ({ ...s })) });
}

function stashInventory(sim: SimState, slot: PlayerSlot, index: number): void {
  const stack = slot.inventory[index];
  const def = stack && sim.content.items.get(stack.item);
  if (!stack || !def) return;
  if (!sim.store.stashAdd(slot.stored, { item: stack.item, qty: stack.qty, maxStack: def.maxStack })) {
    return void slot.outbox.push({ t: "toast", msg: "Stash full" });
  }
  if (slot.weapon === stack.item) slot.weapon = null;
  slot.inventory.splice(index, 1);
}

function unstashInventory(sim: SimState, slot: PlayerSlot, index: number): void {
  const entry = sim.store.stashTake(slot.stored, index);
  if (entry) invAdd(sim, slot, entry.item, entry.qty);
}
