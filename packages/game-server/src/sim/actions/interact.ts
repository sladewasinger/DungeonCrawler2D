import {
  CHUNK_SIZE,
  INTERACT_RANGE,
  REVIVE_HP_FRACTION,
  TILE,
  createBody,
  partyRoomSpawn,
  personalRoomSpawn,
  safeRoomSpawn,
  type EffectEvent,
} from "@dc2d/engine";
import { adjacentToTile } from "../helpers.js";
import { findSpawn } from "../spawn.js";
import type { PlayerSlot, SimState } from "../state.js";

/** The interact intent: party revive, doors (safe room / personal / party / exit), stash. */

export function doInteract(sim: SimState, slot: PlayerSlot, effectEvents: EffectEvent[]): void {
  if (slot.partyId && reviveDownedPartyMember(sim, slot, effectEvents)) return;
  if (slot.downedAtTick !== null) return;
  if (useDoor(sim, slot)) return;

  const tileX = Math.floor(slot.entity.body.x);
  const tileY = Math.floor(slot.entity.body.y);
  if (adjacentToTile(sim, tileX, tileY, TILE.Stash)) {
    slot.outbox.push({ t: "stash", slots: slot.stored.stash.map((s) => ({ ...s })) });
  }
}

/** Revive the nearest downed party member in range; true if one was revived. */
function reviveDownedPartyMember(
  sim: SimState,
  slot: PlayerSlot,
  effectEvents: EffectEvent[],
): boolean {
  const body = slot.entity.body;
  for (const other of sim.players.values()) {
    if (other === slot || other.partyId !== slot.partyId || other.downedAtTick === null) continue;
    const d = Math.hypot(other.entity.body.x - body.x, other.entity.body.y - body.y);
    if (d > INTERACT_RANGE) continue;
    other.downedAtTick = null;
    delete other.entity.downedUntil;
    other.entity.hp = Math.max(1, Math.round(other.entity.maxHp * REVIVE_HP_FRACTION));
    other.outbox.push({ t: "toast", msg: `${slot.entity.name} got you back up!` });
    slot.outbox.push({ t: "toast", msg: `You revived ${other.entity.name}` });
    effectEvents.push({ t: "hp", id: other.entity.id, delta: other.entity.hp, hp: other.entity.hp });
    return true;
  }
  return false;
}

/** Doors: use a nearby solid doorway to teleport. */
function useDoor(sim: SimState, slot: PlayerSlot): boolean {
  const body = slot.entity.body;
  const tileX = Math.floor(body.x);
  const tileY = Math.floor(body.y);
  const door = nearbyDoor(sim, tileX, tileY);
  if (!door) return false;
  switch (door.tile) {
    case TILE.DoorSafeRoom: {
      const doorCx = Math.floor(door.x / CHUNK_SIZE);
      const doorCy = Math.floor(door.y / CHUNK_SIZE);
      teleport(sim, slot, safeRoomSpawn(doorCx, doorCy), { remember: true });
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

function nearbyDoor(sim: SimState, tileX: number, tileY: number): { tile: number; x: number; y: number } | null {
  const atPlayer = sim.world.tileAt(tileX, tileY);
  if (isDoorTile(atPlayer)) return { tile: atPlayer, x: tileX, y: tileY };
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const x = tileX + dx;
      const y = tileY + dy;
      const tile = sim.world.tileAt(x, y);
      if (isDoorTile(tile)) return { tile, x, y };
    }
  }
  return null;
}

function isDoorTile(tile: number): tile is typeof TILE.DoorSafeRoom | typeof TILE.DoorPersonal | typeof TILE.DoorParty | typeof TILE.DoorExit {
  return tile === TILE.DoorSafeRoom || tile === TILE.DoorPersonal || tile === TILE.DoorParty || tile === TILE.DoorExit;
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
  slot.needsFullAreas = true;
  slot.known.clear();
  slot.outbox.push({ t: "teleported" });
}
