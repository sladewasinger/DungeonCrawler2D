import {
  CHUNK_SIZE,
  TILE,
  createBody,
  resolveWorldInteraction,
  partyRoomSpawn,
  personalRoomSpawn,
  safeRoomSpawn,
  safeRoomChunk,
} from "@dc2d/engine";
import { findSpawn } from "../spawn.js";
import { resetInputTimeline } from "../playerInputTimeline.js";
import type { PlayerSlot, SimState } from "../state.js";
import {
  safeRoomDoorAt,
  safeRoomHasCapacity,
} from "../safeRoomDoors.js";
import { queueFoodAttendantGreeting } from "../npcs/foodAttendant/index.js";
import { openLootChest } from "../lootChests.js";
import { claimNearestPet } from "../pets/index.js";

/** The interact intent: party revive, doors (safe room / personal / party / exit), stash. */

export function doInteract(sim: SimState, slot: PlayerSlot): void {
  if (slot.downedAtTick !== null) return;
  if (claimNearestPet(sim, slot)) return;
  if (openLootChest(sim, slot)) return;
  const body = slot.entity.body;
  const target = resolveWorldInteraction(sim.world, body.x, body.y);
  if (target?.kind === "door" && useDoor(sim, slot, target)) return;
  if (target?.kind === "stash") {
    slot.outbox.push({ t: "stash", slots: slot.stored.stash.map((s) => ({ ...s })) });
  }
}

/** Doors: use a nearby solid doorway to teleport. */
function useDoor(
  sim: SimState,
  slot: PlayerSlot,
  door: { tile: number; x: number; y: number },
): boolean {
  const assigned = safeRoomDoorAt(sim, door.x, door.y);
  if (assigned) {
    return useAssignedRoomDoor(sim, slot, assigned.ownerId, assigned.tile);
  }
  switch (door.tile) {
    case TILE.DoorSafeRoom: {
      const doorCx = Math.floor(door.x / CHUNK_SIZE);
      const doorCy = Math.floor(door.y / CHUNK_SIZE);
      const room = safeRoomChunk(doorCx, doorCy);
      if (!safeRoomHasCapacity(sim, room.cx, room.cy)) {
        slot.outbox.push({ t: "toast", msg: "That safe room is full" });
        return true;
      }
      teleport(sim, slot, safeRoomSpawn(doorCx, doorCy), { remember: true });
      queueFoodAttendantGreeting(sim, slot, room.cx, room.cy);
      slot.outbox.push({ t: "toast", msg: "The safe room. No fighting in here." });
      return true;
    }
    case TILE.DoorPersonal:
      teleport(sim, slot, personalRoomSpawn(slot.stored.slot), { remember: true });
      slot.outbox.push({ t: "toast", msg: "Your room. Stash and crafting table inside." });
      return true;
    case TILE.DoorParty:
      useDoorParty(sim, slot);
      return true;
    case TILE.DoorExit:
      teleport(sim, slot, slot.returnStack.pop() ?? findSpawn(sim), { remember: false });
      return true;
    default:
      return false;
  }
}

function useAssignedRoomDoor(
  sim: SimState,
  slot: PlayerSlot,
  ownerId: string,
  tile: number,
): boolean {
  const owner = sim.players.get(ownerId);
  if (!owner?.connected) return true;
  if (tile === TILE.DoorPersonal) {
    if (slot.entity.id !== ownerId) {
      slot.outbox.push({ t: "toast", msg: "That personal room is private" });
      return true;
    }
    teleport(sim, slot, personalRoomSpawn(owner.stored.slot), { remember: true });
    slot.outbox.push({ t: "toast", msg: "Your personal room" });
    return true;
  }
  if (!owner.partyId || slot.partyId !== owner.partyId) {
    slot.outbox.push({ t: "toast", msg: "That party room is private" });
    return true;
  }
  const party = sim.parties.get(owner.partyId);
  if (!party) return true;
  party.roomSlot ??= sim.nextPartyRoom++;
  teleport(sim, slot, partyRoomSpawn(party.roomSlot), { remember: true });
  slot.outbox.push({ t: "toast", msg: "The party room" });
  return true;
}

function useDoorParty(sim: SimState, slot: PlayerSlot): void {
  if (!slot.partyId) {
    slot.outbox.push({ t: "toast", msg: "You're not in a party" });
    return;
  }
  const party = sim.parties.get(slot.partyId);
  if (!party) return;
  party.roomSlot ??= sim.nextPartyRoom++;
  teleport(sim, slot, partyRoomSpawn(party.roomSlot), { remember: true });
  slot.outbox.push({ t: "toast", msg: "The party room" });
}

export function teleport(
  sim: SimState,
  slot: PlayerSlot,
  to: { x: number; y: number; z?: number },
  opts: { remember: boolean },
): void {
  if (opts.remember) {
    slot.returnStack.push({ x: slot.entity.body.x, y: slot.entity.body.y, z: slot.entity.body.z });
    if (slot.returnStack.length > 4) slot.returnStack.shift();
  }
  const z = to.z ?? sim.world.groundAt(to.x, to.y);
  slot.entity.body = createBody(to.x, to.y, z);
  resetInputTimeline(slot);
  slot.needsFullAreas = true;
  slot.known.clear();
  slot.outbox.push({ t: "teleported" });
}
