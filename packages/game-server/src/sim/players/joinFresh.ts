import {
  MOVE_SPEED,
  PLAYER_MAX_HP,
  createBody,
  makeEntity,
  newEntityId,
  type Entity,
  type PlayerSkin,
} from "@dc2d/engine";
import { announceFloorEntry, announceJoin, announceStairwayHint, broadcastAnnouncement } from "../announcer/index.js";
import { sendContactsUpdated } from "../combat/contacts.js";
import { ensureStarterKit } from "../inventory/inventory.js";
import { refreshModerationBindings, sendModerationState } from "../moderation.js";
import { findPlayerSpawn } from "../spawn/playerSpawn.js";
import { secureSpawnHandoff } from "../spawnSafety/spawnSafety.js";
import type { PlayerSlot, SimState } from "../state/state.js";

export function createPlayerEntity(
  name: string,
  spawn: { x: number; y: number; z: number },
  skin: PlayerSkin | undefined,
): Entity {
  return makeEntity("player", createBody(spawn.x, spawn.y, spawn.z), {
    id: newEntityId("p"), name, ...(skin ? { skin } : {}), hp: PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP,
    baseSpeed: MOVE_SPEED, tags: new Set(["player", "organic"]), facing: { x: 0, y: 1 },
  });
}

export function completeFreshJoin(sim: SimState, slot: PlayerSlot, name: string): void {
  secureSpawnHandoff(sim, slot);
  ensureStarterKit(sim, slot);
  refreshModerationBindings(sim);
  sendModerationState(slot);
  sendContactsUpdated(sim, slot);
  broadcastAnnouncement(sim, announceJoin({ tick: sim.tickCount, playerId: slot.entity.id, name, ordinal: slot.stored.slot + 1 }));
  slot.outbox.push(announceFloorEntry(sim.world.floor));
  const stairHint = announceStairwayHint(sim.tickCount, slot.entity.id, sim.world);
  if (stairHint) slot.outbox.push(stairHint);
  sim.store.recordFloor(slot.stored, sim.world.floor);
}

export function initialSpawn(sim: SimState): { x: number; y: number; z: number } {
  return findPlayerSpawn(sim, sim.players.size);
}
