import { INTERACT_RANGE, TICK_RATE } from "@dc2d/engine";
import { invAdd } from "../inventory/inventory.js";
import type { LootChest, PlayerSlot, SimState } from "../state/state.js";
export { PLAYER_LOOT_CHEST_DEF_ID, spawnPlayerLootChest } from "./spawn.js";

export function nearestLootChest(
  sim: SimState,
  slot: PlayerSlot,
): LootChest | null {
  let nearest: LootChest | null = null;
  let nearestDistance = INTERACT_RANGE;
  for (const chest of sim.lootChests.values()) {
    const distance = chestDistance(slot, chest);
    if (!isNearestCandidate({ chest, distance, nearest, nearestDistance })) continue;
    nearest = chest;
    nearestDistance = distance;
  }
  return nearest;
}

function chestDistance(slot: PlayerSlot, chest: LootChest): number {
  if (Math.abs(chest.entity.body.z - slot.entity.body.z) > 1.5) return Infinity;
  return Math.hypot(chest.entity.body.x - slot.entity.body.x, chest.entity.body.y - slot.entity.body.y);
}

function isNearestCandidate(request: {
  chest: LootChest;
  distance: number;
  nearest: LootChest | null;
  nearestDistance: number;
}): boolean {
  const { chest, distance, nearest, nearestDistance } = request;
  if (distance > nearestDistance) return false;
  return distance !== nearestDistance || !nearest || chest.entity.id < nearest.entity.id;
}

function inRange(slot: PlayerSlot, chest: LootChest): boolean {
  if (Math.abs(chest.entity.body.z - slot.entity.body.z) > 1.5) return false;
  return Math.hypot(
    chest.entity.body.x - slot.entity.body.x,
    chest.entity.body.y - slot.entity.body.y,
  ) <= INTERACT_RANGE;
}

function canLoot(sim: SimState, slot: PlayerSlot, chest: LootChest): boolean {
  return sim.tickCount >= chest.unlockAtTick || slot.entity.id === chest.killerId;
}

function publishChest(slot: PlayerSlot, chest: LootChest): void {
  slot.outbox.push({
    t: "lootChest",
    chestId: chest.entity.id,
    slots: chest.slots.map((stack) => ({ ...stack })),
  });
}

function takeOneStack(chest: LootChest, item: string | undefined) {
  if (!item) return [];
  const index = chest.slots.findIndex((stack) => stack.item === item);
  return index < 0 ? [] : chest.slots.splice(index, 1);
}

export function openLootChest(
  sim: SimState,
  slot: PlayerSlot,
): boolean {
  const chest = nearestLootChest(sim, slot);
  if (!chest) return false;
  return openResolvedLootChest(sim, slot, chest);
}

function openResolvedLootChest(
  sim: SimState,
  slot: PlayerSlot,
  chest: LootChest,
): boolean {
  if (!canLoot(sim, slot, chest)) {
    const seconds = Math.ceil((chest.unlockAtTick - sim.tickCount) / TICK_RATE);
    slot.outbox.push({ t: "toast", msg: `Loot reserved for ${seconds}s` });
    return true;
  }
  if (chest.viewerId !== null && chest.viewerId !== slot.entity.id) {
    slot.outbox.push({ t: "toast", msg: "Someone else is viewing this chest" });
    return true;
  }
  chest.viewerId = slot.entity.id;
  publishChest(slot, chest);
  return true;
}

export function openLootChestById(
  sim: SimState,
  slot: PlayerSlot,
  chestId: string,
): boolean {
  const chest = sim.lootChests.get(chestId);
  if (!chest) {
    slot.outbox.push({ t: "toast", msg: "Loot chest is no longer available" });
    return true;
  }
  if (!inRange(slot, chest)) {
    slot.outbox.push({ t: "toast", msg: "Too far from loot chest" });
    return true;
  }
  return openResolvedLootChest(sim, slot, chest);
}

export function closeLootChest(
  sim: SimState,
  slot: PlayerSlot,
  chestId: string,
): void {
  const chest = sim.lootChests.get(chestId);
  if (chest?.viewerId === slot.entity.id) chest.viewerId = null;
}

export function takeLoot(sim: SimState, slot: PlayerSlot, request: { chestId: string; op: "take" | "takeAll"; item?: string | undefined }): void {
  const chest = sim.lootChests.get(request.chestId);
  if (!canTakeLoot(sim, slot, chest)) return;
  const stacks = request.op === "takeAll"
    ? chest.slots.splice(0)
    : takeOneStack(chest, request.item);
  for (const stack of stacks) invAdd(sim, slot, stack.item, stack.qty);
  publishChest(slot, chest);
  if (chest.slots.length === 0) sim.lootChests.delete(request.chestId);
}

function canTakeLoot(sim: SimState, slot: PlayerSlot, chest: LootChest | undefined): chest is LootChest {
  return !!chest && chest.viewerId === slot.entity.id && inRange(slot, chest) && canLoot(sim, slot, chest);
}

export function expireLootChests(sim: SimState): void {
  for (const [id, chest] of sim.lootChests) {
    expireLootChest(sim, id, chest);
  }
}

function expireLootChest(sim: SimState, id: string, chest: LootChest): void {
  if (sim.tickCount >= chest.expiresAtTick) {
    sim.lootChests.delete(id);
    return;
  }
  if (chest.viewerId !== null && shouldReleaseViewer(sim, chest)) chest.viewerId = null;
}

function shouldReleaseViewer(sim: SimState, chest: LootChest): boolean {
  const viewer = sim.players.get(chest.viewerId!);
  return !viewer?.connected || viewer.entity.hp <= 0 || !inRange(viewer, chest);
}
