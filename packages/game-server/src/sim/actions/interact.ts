import {
  CHUNK_SIZE,
  TILE,
  createBody,
  resolveWorldInteraction,
  partyRoomSpawn,
  personalRoomSpawn,
  safeRoomSpawn,
  safeRoomChunk,
  roomKindAt,
} from "@dc2d/engine";
import { findDungeonEntry } from "../spawn/dungeonEntry.js";
import { findSpawn } from "../spawn/spawn.js";
import { secureSpawnHandoff } from "../spawnSafety/spawnSafety.js";
import { resetInputTimeline } from "../players/playerInputTimeline.js";
import type { PlayerSlot, SimState } from "../state/state.js";
import {
  safeRoomDoorAt,
  safeRoomHasCapacity,
} from "../core/safeRoomDoors.js";
import { queueFoodAttendantGreeting } from "../npcs/foodAttendant/index.js";
import { openLootChest } from "../lootChests/lootChests.js";
import { claimNearestPet } from "../pets/index.js";

/** The interact intent: revive, pet claims, doors, stash, and floor exits. */

interface InteractContext {
  sim: SimState;
  slot: PlayerSlot;
}

interface DoorContext extends InteractContext {
  door: { tile: number; x: number; y: number };
}

export function doInteract({ sim, slot }: InteractContext): void {
  if (slot.downedAtTick !== null) return;
  if (claimNearestPet(sim, slot) || openLootChest(sim, slot)) return;
  const body = slot.entity.body;
  const target = resolveWorldInteraction(sim.world, body.x, body.y);
  if (target?.kind === "door") return void useDoor({ sim, slot, door: target });
  if (target?.kind === "stash") sendStash(slot);
}

function sendStash(slot: PlayerSlot): void {
  slot.outbox.push({ t: "stash", slots: slot.stored.stash.map((s) => ({ ...s })) });
}

/** Doors: use a nearby wall-mounted or ground-mounted feature to teleport. */
function useDoor({ sim, slot, door }: DoorContext): boolean {
  const assigned = safeRoomDoorAt(sim, door.x, door.y);
  if (assigned) return useAssignedRoomDoor({ sim, slot, ownerId: assigned.ownerId, tile: assigned.tile });
  switch (door.tile) {
    case TILE.DoorSafeRoom: return useSafeRoomDoor({ sim, slot, door });
    case TILE.DoorPersonal: return usePersonalDoor({ sim, slot });
    case TILE.DoorParty: return usePartyDoor({ sim, slot });
    case TILE.DoorExit: return useExitDoor({ sim, slot });
    default:
      return false;
  }
}

function useSafeRoomDoor({ sim, slot, door }: DoorContext): boolean {
  const doorCx = Math.floor(door.x / CHUNK_SIZE);
  const doorCy = Math.floor(door.y / CHUNK_SIZE);
  const room = safeRoomChunk(doorCx, doorCy);
  if (!safeRoomHasCapacity(sim, room.cx, room.cy)) return notifyFullSafeRoom(slot);
  teleport({ sim, slot, to: safeRoomSpawn(doorCx, doorCy), remember: true });
  queueFoodAttendantGreeting(sim, slot, room);
  slot.outbox.push({ t: "toast", msg: "The safe room. No fighting in here." });
  return true;
}

function notifyFullSafeRoom(slot: PlayerSlot): true {
  slot.outbox.push({ t: "toast", msg: "That safe room is full" });
  return true;
}

function usePersonalDoor({ sim, slot }: InteractContext): true {
  teleport({ sim, slot, to: personalRoomSpawn(slot.stored.slot), remember: true });
  slot.outbox.push({ t: "toast", msg: "Your room. Stash and crafting table inside." });
  return true;
}

function usePartyDoor(context: InteractContext): true {
  useDoorParty(context);
  return true;
}

function useExitDoor({ sim, slot }: InteractContext): true {
  if (currentRoomKind(slot) === "spawn") {
    teleport({ sim, slot, to: findDungeonEntry(sim), remember: false });
    slot.returnStack = [];
    secureSpawnHandoff(sim, slot);
    slot.outbox.push({ t: "toast", msg: "No way back but the grave. Do some damage." });
    return true;
  }
  teleport({ sim, slot, to: slot.returnStack.pop() ?? findSpawn(sim), remember: false });
  return true;
}

function currentRoomKind(slot: PlayerSlot) {
  const cx = Math.floor(slot.entity.body.x / CHUNK_SIZE);
  const cy = Math.floor(slot.entity.body.y / CHUNK_SIZE);
  return roomKindAt(cx, cy);
}

function useAssignedRoomDoor({ sim, slot, ownerId, tile }: InteractContext & { ownerId: string; tile: number }): boolean {
  const owner = sim.players.get(ownerId);
  if (!owner?.connected) return true;
  if (tile === TILE.DoorPersonal) return useOwnedPersonalDoor({ sim, slot, ownerId, owner });
  if (!owner.partyId || slot.partyId !== owner.partyId) {
    slot.outbox.push({ t: "toast", msg: "That party room is private" });
    return true;
  }
  const party = sim.parties.get(owner.partyId);
  if (!party) return true;
  party.roomSlot ??= sim.nextPartyRoom++;
  teleport({ sim, slot, to: partyRoomSpawn(party.roomSlot), remember: true });
  slot.outbox.push({ t: "toast", msg: "The party room" });
  return true;
}

function useOwnedPersonalDoor({ sim, slot, ownerId, owner }: InteractContext & { ownerId: string; owner: PlayerSlot }): true {
  if (slot.entity.id !== ownerId) {
    slot.outbox.push({ t: "toast", msg: "That personal room is private" });
    return true;
  }
  teleport({ sim, slot, to: personalRoomSpawn(owner.stored.slot), remember: true });
  slot.outbox.push({ t: "toast", msg: "Your personal room" });
  return true;
}

function useDoorParty({ sim, slot }: InteractContext): void {
  if (!slot.partyId) {
    slot.outbox.push({ t: "toast", msg: "You're not in a party" });
    return;
  }
  const party = sim.parties.get(slot.partyId);
  if (!party) return;
  party.roomSlot ??= sim.nextPartyRoom++;
  teleport({ sim, slot, to: partyRoomSpawn(party.roomSlot), remember: true });
  slot.outbox.push({ t: "toast", msg: "The party room" });
}

export function teleport({ sim, slot, to, remember }: InteractContext & { to: { x: number; y: number; z?: number }; remember: boolean }): void {
  if (remember) {
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
