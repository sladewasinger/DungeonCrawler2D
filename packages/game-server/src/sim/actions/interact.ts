import {
  CHUNK_SIZE,
  INTERACT_RANGE,
  REVIVE_HP_FRACTION,
  TILE,
  createBody,
  resolveWorldInteraction,
  partyRoomSpawn,
  personalRoomSpawn,
  safeRoomSpawn,
  type EffectEvent,
} from "@dc2d/engine";
import { findSpawn } from "../spawn.js";
import type { PlayerSlot, SimState } from "../state.js";

/** The interact intent: party revive, doors (safe room / personal / party / exit), stash. */

export function doInteract(sim: SimState, slot: PlayerSlot, effectEvents: EffectEvent[]): void {
  if (slot.partyId && reviveDownedPartyMember(sim, slot, effectEvents)) return;
  if (slot.downedAtTick !== null) return;
  const body = slot.entity.body;
  const target = resolveWorldInteraction(sim.world, body.x, body.y);
  if (target?.kind === "door" && useDoor(sim, slot, target)) return;
  if (target?.kind === "stash") {
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
  const candidates = [...sim.players.values()]
    .filter((other) =>
      other !== slot &&
      other.connected &&
      other.partyId === slot.partyId &&
      other.downedAtTick !== null
    )
    .map((other) => ({
      other,
      distance: Math.hypot(other.entity.body.x - body.x, other.entity.body.y - body.y),
    }))
    .filter(({ distance }) => distance <= INTERACT_RANGE)
    .sort((a, b) => a.distance - b.distance || a.other.entity.id.localeCompare(b.other.entity.id));
  const target = candidates[0]?.other;
  if (!target) return false;
  target.downedAtTick = null;
  delete target.entity.downedUntil;
  target.entity.hp = Math.max(1, Math.round(target.entity.maxHp * REVIVE_HP_FRACTION));
  target.outbox.push({ t: "toast", msg: `${slot.entity.name} got you back up!` });
  slot.outbox.push({ t: "toast", msg: `You revived ${target.entity.name}` });
  effectEvents.push({ t: "hp", id: target.entity.id, delta: target.entity.hp, hp: target.entity.hp });
  return true;
}

/** Doors: use a nearby solid doorway to teleport. */
function useDoor(
  sim: SimState,
  slot: PlayerSlot,
  door: { tile: number; x: number; y: number },
): boolean {
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
