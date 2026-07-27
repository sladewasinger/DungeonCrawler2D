import { LOOT_CHEST_LIFETIME_TICKS, LOOT_CHEST_LOCK_TICKS, createBody, makeEntity, newEntityId } from "@dc2d/engine";
import type { LootChest, PlayerSlot, SimState } from "../state/state.js";

export const PLAYER_LOOT_CHEST_DEF_ID = "player-loot-chest";

const OFFSETS = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1], [2, 0], [0, 2], [-2, 0], [0, -2]] as const;

export function spawnPlayerLootChest(sim: SimState, slot: PlayerSlot): LootChest | null {
  if (slot.inventory.length === 0) return emptyInventory(slot);
  const position = chestPosition(sim, slot);
  const killer = slot.lastDamagedByPlayerId ? sim.players.get(slot.lastDamagedByPlayerId) : undefined;
  const entity = makeChestEntity(sim, slot, position);
  const chest = createLootChest({ sim, slot, entity, killer });
  slot.inventory = [];
  slot.weapon = null;
  sim.lootChests.set(entity.id, chest);
  return chest;
}

function emptyInventory(slot: PlayerSlot): null {
  slot.weapon = null;
  return null;
}

function makeChestEntity(sim: SimState, slot: PlayerSlot, position: { x: number; y: number; z: number }) {
  return makeEntity("item", createBody(position.x, position.y, position.z), {
    id: newEntityId("loot"), defId: PLAYER_LOOT_CHEST_DEF_ID,
    name: `[DEAD] ${slot.entity.name ?? "Crawler"}'s loot`,
    expiresAtTick: sim.tickCount + LOOT_CHEST_LIFETIME_TICKS, tags: new Set(["loot-chest"]),
  });
}

function createLootChest({ sim, slot, entity, killer }: {
  sim: SimState;
  slot: PlayerSlot;
  entity: ReturnType<typeof makeChestEntity>;
  killer: PlayerSlot | undefined;
}): LootChest {
  const killerId = killer?.entity.id ?? null;
  return {
    entity, slots: slot.inventory.map((stack) => ({ ...stack })), viewerId: null,
    victimId: slot.entity.id, victimName: slot.entity.name ?? "Crawler", killerId,
    killerName: killer?.entity.name ?? null,
    unlockAtTick: killerId ? sim.tickCount + LOOT_CHEST_LOCK_TICKS : sim.tickCount,
    expiresAtTick: sim.tickCount + LOOT_CHEST_LIFETIME_TICKS,
  };
}

function chestPosition(sim: SimState, slot: PlayerSlot): { x: number; y: number; z: number } {
  const origin = { x: Math.floor(slot.entity.body.x), y: Math.floor(slot.entity.body.y) };
  const start = Math.floor(sim.rng.next() * OFFSETS.length);
  for (let step = 0; step < OFFSETS.length; step++) {
    const { x, y } = offsetTile(origin, OFFSETS[(start + step) % OFFSETS.length]!);
    if (!sim.world.isWalkable(x, y)) continue;
    const position = { x: x + 0.5, y: y + 0.5, z: sim.world.groundAt(x + 0.5, y + 0.5) };
    if (Math.abs(position.z - slot.entity.body.z) <= 1.5) return position;
  }
  return { x: slot.entity.body.x, y: slot.entity.body.y, z: sim.world.groundAt(slot.entity.body.x, slot.entity.body.y) };
}

function offsetTile(origin: { x: number; y: number }, offset: readonly [number, number]): { x: number; y: number } {
  return { x: origin.x + offset[0], y: origin.y + offset[1] };
}
