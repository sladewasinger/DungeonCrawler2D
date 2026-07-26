import {
  CHUNK_SIZE,
  SAFE_ROOM_MAX_OCCUPANTS,
  TILE,
  roomKindAt,
  safeRoomDoorPositions,
  type SafeRoomDoorSnapshot,
} from "@dc2d/engine";
import type { PlayerSlot, SimState } from "./state.js";

const roomCoordinates = (slot: PlayerSlot): { cx: number; cy: number } | null => {
  const cx = Math.floor(slot.entity.body.x / CHUNK_SIZE);
  const cy = Math.floor(slot.entity.body.y / CHUNK_SIZE);
  return roomKindAt(cx, cy) === "safe" ? { cx, cy } : null;
};

const roomKey = (cx: number, cy: number): string => `${cx},${cy}`;

const snapshotCache = new WeakMap<
  SimState,
  { tick: number; assignments: Map<string, SafeRoomDoorSnapshot[]> }
>();

function buildSafeRoomDoorAssignments(
  sim: SimState,
): Map<string, SafeRoomDoorSnapshot[]> {
  const occupants = new Map<string, PlayerSlot[]>();
  for (const slot of sim.players.values()) {
    if (!slot.connected) continue;
    const room = roomCoordinates(slot);
    if (!room) continue;
    const key = roomKey(room.cx, room.cy);
    const group = occupants.get(key) ?? [];
    group.push(slot);
    occupants.set(key, group);
  }
  const assignments = new Map<string, SafeRoomDoorSnapshot[]>();
  for (const [key, group] of occupants) {
    const [cx, cy] = key.split(",").map(Number) as [number, number];
    const positions = safeRoomDoorPositions(cx, cy);
    const doors = group
      .sort((a, b) => a.entity.id.localeCompare(b.entity.id))
      .slice(0, SAFE_ROOM_MAX_OCCUPANTS)
      .map((owner, index) => ({
        ...positions[index]!,
        tile: owner.partyId ? TILE.DoorParty : TILE.DoorPersonal,
        ownerId: owner.entity.id,
      }));
    assignments.set(key, doors);
  }
  return assignments;
}

export function syncSafeRoomDoors(sim: SimState): void {
  const doors = [...buildSafeRoomDoorAssignments(sim).values()].flat();
  sim.world.replaceTileOverrides(doors);
}

function snapshotAssignments(sim: SimState): Map<string, SafeRoomDoorSnapshot[]> {
  const cached = snapshotCache.get(sim);
  if (cached?.tick === sim.tickCount) return cached.assignments;
  const assignments = buildSafeRoomDoorAssignments(sim);
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
  return buildSafeRoomDoorAssignments(sim)
    .get(roomKey(cx, cy))
    ?.find((door) => door.x === x && door.y === y);
}

export function safeRoomHasCapacity(sim: SimState, cx: number, cy: number): boolean {
  let occupants = 0;
  for (const slot of sim.players.values()) {
    if (!slot.connected) continue;
    const room = roomCoordinates(slot);
    if (room?.cx === cx && room.cy === cy) occupants++;
  }
  return occupants < SAFE_ROOM_MAX_OCCUPANTS;
}
