import {
  INTERACT_RANGE,
  LOOT_CHEST_LIFETIME_TICKS,
  LOOT_CHEST_LOCK_TICKS,
  TICK_RATE,
  createBody,
  makeEntity,
  newEntityId,
} from "@dc2d/engine";
import { invAdd } from "./inventory.js";
import type { LootChest, PlayerSlot, SimState } from "./state.js";

export const PLAYER_LOOT_CHEST_DEF_ID = "player-loot-chest";

const OFFSETS = [
  [1, 0], [0, 1], [-1, 0], [0, -1],
  [1, 1], [-1, 1], [-1, -1], [1, -1],
  [2, 0], [0, 2], [-2, 0], [0, -2],
] as const;

function chestPosition(
  sim: SimState,
  slot: PlayerSlot,
): { x: number; y: number; z: number } {
  const originX = Math.floor(slot.entity.body.x);
  const originY = Math.floor(slot.entity.body.y);
  const start = Math.floor(sim.rng.next() * OFFSETS.length);
  for (let step = 0; step < OFFSETS.length; step++) {
    const offset = OFFSETS[(start + step) % OFFSETS.length]!;
    const tileX = originX + offset[0];
    const tileY = originY + offset[1];
    if (!sim.world.isWalkable(tileX, tileY)) continue;
    const x = tileX + 0.5;
    const y = tileY + 0.5;
    const z = sim.world.groundAt(x, y);
    if (Math.abs(z - slot.entity.body.z) <= 1.5) return { x, y, z };
  }
  return {
    x: slot.entity.body.x,
    y: slot.entity.body.y,
    z: sim.world.groundAt(slot.entity.body.x, slot.entity.body.y),
  };
}

export function spawnPlayerLootChest(
  sim: SimState,
  slot: PlayerSlot,
): LootChest | null {
  if (slot.inventory.length === 0) {
    slot.weapon = null;
    return null;
  }
  const position = chestPosition(sim, slot);
  const killer = slot.lastDamagedByPlayerId
    ? sim.players.get(slot.lastDamagedByPlayerId)
    : undefined;
  const killerId = killer?.entity.id ?? null;
  const entity = makeEntity("item", createBody(position.x, position.y, position.z), {
    id: newEntityId("loot"),
    defId: PLAYER_LOOT_CHEST_DEF_ID,
    name: `[DEAD] ${slot.entity.name ?? "Crawler"}'s loot`,
    expiresAtTick: sim.tickCount + LOOT_CHEST_LIFETIME_TICKS,
    tags: new Set(["loot-chest"]),
  });
  const chest: LootChest = {
    entity,
    slots: slot.inventory.map((stack) => ({ ...stack })),
    viewerId: null,
    victimId: slot.entity.id,
    victimName: slot.entity.name ?? "Crawler",
    killerId,
    killerName: killer?.entity.name ?? null,
    unlockAtTick: killerId ? sim.tickCount + LOOT_CHEST_LOCK_TICKS : sim.tickCount,
    expiresAtTick: sim.tickCount + LOOT_CHEST_LIFETIME_TICKS,
  };
  slot.inventory = [];
  slot.weapon = null;
  sim.lootChests.set(entity.id, chest);
  return chest;
}

export function nearestLootChest(
  sim: SimState,
  slot: PlayerSlot,
): LootChest | null {
  let nearest: LootChest | null = null;
  let nearestDistance = INTERACT_RANGE;
  for (const chest of sim.lootChests.values()) {
    if (Math.abs(chest.entity.body.z - slot.entity.body.z) > 1.5) continue;
    const distance = Math.hypot(
      chest.entity.body.x - slot.entity.body.x,
      chest.entity.body.y - slot.entity.body.y,
    );
    if (distance > nearestDistance ||
      (nearest && distance === nearestDistance && chest.entity.id >= nearest.entity.id)) continue;
    nearest = chest;
    nearestDistance = distance;
  }
  return nearest;
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

export function takeLoot(
  sim: SimState,
  slot: PlayerSlot,
  chestId: string,
  op: "take" | "takeAll",
  item?: string,
): void {
  const chest = sim.lootChests.get(chestId);
  if (!chest || chest.viewerId !== slot.entity.id || !inRange(slot, chest) ||
    !canLoot(sim, slot, chest)) return;
  const stacks = op === "takeAll"
    ? chest.slots.splice(0)
    : takeOneStack(chest, item);
  for (const stack of stacks) invAdd(sim, slot, stack.item, stack.qty);
  publishChest(slot, chest);
  if (chest.slots.length === 0) sim.lootChests.delete(chestId);
}

export function expireLootChests(sim: SimState): void {
  for (const [id, chest] of sim.lootChests) {
    if (sim.tickCount >= chest.expiresAtTick) {
      sim.lootChests.delete(id);
      continue;
    }
    if (chest.viewerId === null) continue;
    const viewer = sim.players.get(chest.viewerId);
    if (!viewer?.connected || viewer.entity.hp <= 0 || !inRange(viewer, chest)) {
      chest.viewerId = null;
    }
  }
}
