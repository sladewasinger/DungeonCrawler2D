import {
  CHUNK_SIZE,
  SAFE_ROOM_MAX_OCCUPANTS,
  TILE,
  WALL_DOOR_FEATURE_HEIGHT,
  partyRoomDoorPositions,
  roomKindAt,
  safeRoomDoorPositions,
  type RoomKind,
  type SafeRoomDoorSnapshot,
} from "@dc2d/engine";
import type { Party, PlayerSlot, SimState } from "../state/state.js";

interface RoomCoordinates {
  cx: number;
  cy: number;
  kind: RoomKind;
}

const roomCoordinates = (slot: PlayerSlot): RoomCoordinates | null => {
  const cx = Math.floor(slot.entity.body.x / CHUNK_SIZE);
  const cy = Math.floor(slot.entity.body.y / CHUNK_SIZE);
  const kind = roomKindAt(cx, cy);
  return kind ? { cx, cy, kind } : null;
};

const roomKey = (cx: number, cy: number): string => `${cx},${cy}`;

const snapshotCache = new WeakMap<SimState, { tick: number; assignments: Map<string, SafeRoomDoorSnapshot[]> }>();

function safeRoomDestinations(group: PlayerSlot[]): PlayerSlot[] {
  const destinations = new Map<string, PlayerSlot>();
  for (const slot of group.sort((a, b) => a.entity.id.localeCompare(b.entity.id))) {
    const key = slot.partyId ? `party:${slot.partyId}` : `player:${slot.entity.id}`;
    if (!destinations.has(key)) destinations.set(key, slot);
  }
  return [...destinations.values()].slice(0, SAFE_ROOM_MAX_OCCUPANTS);
}

function safeRoomAssignments(
  cx: number,
  cy: number,
  occupants: PlayerSlot[],
): SafeRoomDoorSnapshot[] {
  const positions = safeRoomDoorPositions(cx, cy);
  return safeRoomDestinations(occupants).flatMap((owner, index) => {
    const position = positions[index];
    if (!position) return [];
    return [{
      ...position,
      tile: owner.partyId ? TILE.DoorParty : TILE.DoorPersonal,
      featureHeight: WALL_DOOR_FEATURE_HEIGHT,
      ownerId: owner.entity.id,
      label: owner.partyId ? "PARTY ROOM" : `${owner.entity.name}'S ROOM`,
    }];
  });
}

function partyForRoom(sim: SimState, cx: number): Party | undefined {
  for (const party of sim.parties.values()) {
    if (party.roomSlot !== null && party.roomSlot * 2 === cx) return party;
  }
  return undefined;
}

function partyRoomAssignments(
  sim: SimState,
  cx: number,
  cy: number,
): SafeRoomDoorSnapshot[] {
  const party = partyForRoom(sim, cx);
  if (!party) return [];
  const positions = partyRoomDoorPositions(cx, cy);
  return [...party.members]
    .map((id) => sim.players.get(id))
    .filter((slot): slot is PlayerSlot => Boolean(slot))
    .sort((a, b) => a.entity.id.localeCompare(b.entity.id))
    .slice(0, positions.length)
    .flatMap((owner, index) => {
      const position = positions[index];
      if (!position) return [];
      return [{
        ...position,
        tile: TILE.DoorPersonal,
        featureHeight: WALL_DOOR_FEATURE_HEIGHT,
        ownerId: owner.entity.id,
        label: `${owner.entity.name}'S ROOM`,
      }];
    });
}

function buildRoomDoorAssignments(sim: SimState): Map<string, SafeRoomDoorSnapshot[]> {
  return assignmentsForOccupants(sim, collectRoomOccupants(sim));
}

type RoomOccupants = Map<string, { room: RoomCoordinates; slots: PlayerSlot[] }>;

function collectRoomOccupants(sim: SimState): RoomOccupants {
  const occupants = new Map<string, { room: RoomCoordinates; slots: PlayerSlot[] }>();
  for (const slot of sim.players.values()) {
    if (!slot.connected) continue;
    const room = roomCoordinates(slot);
    if (!room || room.kind === "personal" || room.kind === "spawn") continue;
    const key = roomKey(room.cx, room.cy);
    const entry = occupants.get(key) ?? { room, slots: [] };
    entry.slots.push(slot);
    occupants.set(key, entry);
  }
  return occupants;
}

function assignmentsForOccupants(sim: SimState, occupants: RoomOccupants): Map<string, SafeRoomDoorSnapshot[]> {
  const assignments = new Map<string, SafeRoomDoorSnapshot[]>();
  for (const [key, entry] of occupants) {
    const { cx, cy, kind } = entry.room;
    assignments.set(
      key,
      kind === "safe"
        ? safeRoomAssignments(cx, cy, entry.slots)
        : partyRoomAssignments(sim, cx, cy),
    );
  }
  return assignments;
}

export function syncSafeRoomDoors(sim: SimState): void {
  const doors = [...buildRoomDoorAssignments(sim).values()].flat();
  sim.world.replaceFeatureOverrides(doors);
}

function snapshotAssignments(sim: SimState): Map<string, SafeRoomDoorSnapshot[]> {
  const cached = snapshotCache.get(sim);
  if (cached?.tick === sim.tickCount) return cached.assignments;
  const assignments = buildRoomDoorAssignments(sim);
  snapshotCache.set(sim, { tick: sim.tickCount, assignments });
  return assignments;
}

export function safeRoomDoorsForSlot(
  sim: SimState,
  slot: PlayerSlot,
): SafeRoomDoorSnapshot[] {
  const room = roomCoordinates(slot);
  if (!room) return [];
  return snapshotAssignments(sim).get(roomKey(room.cx, room.cy)) ?? [];
}

export function safeRoomDoorAt(
  sim: SimState,
  x: number,
  y: number,
): SafeRoomDoorSnapshot | undefined {
  const cx = Math.floor(x / CHUNK_SIZE);
  const cy = Math.floor(y / CHUNK_SIZE);
  return buildRoomDoorAssignments(sim)
    .get(roomKey(cx, cy))
    ?.find((door) => door.x === x && door.y === y);
}

export function safeRoomHasCapacity(sim: SimState, cx: number, cy: number): boolean {
  return [...sim.players.values()]
    .filter((slot) => {
      const room = roomCoordinates(slot);
      return slot.connected && room?.cx === cx && room.cy === cy;
    })
    .length < SAFE_ROOM_MAX_OCCUPANTS;
}
