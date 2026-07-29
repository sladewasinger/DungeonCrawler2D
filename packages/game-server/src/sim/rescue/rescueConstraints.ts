import {
  CHUNK_SIZE,
  isRoomChunk,
  miniBossArenaAtPosition,
} from "@dc2d/engine";
import type { Entity } from "@dc2d/engine";
import type { PlayerSlot, SimState } from "../state/state.js";
import { occupiesMiniBossArena } from "../enemies/miniBossArena/runtime.js";
import type { RescueDestinationSearch } from "./rescueDestination.js";

const ROOM_REJECTION = "Rescue is only available in the dungeon.";
const ARENA_REJECTION = "Use the arena gate. There is no rescue from a fight.";

export interface RescueConstraints {
  readonly rejection: string | null;
  readonly allowsTile: RescueDestinationSearch["allowsTile"];
  readonly isOccupied: RescueDestinationSearch["isOccupied"];
}

/** Keeps production rescue from crossing reserved rooms or arena boundaries. */
export function rescueConstraints(
  sim: SimState,
  slot: PlayerSlot,
): RescueConstraints {
  const body = slot.entity.body;
  if (isReservedRoomPosition(body.y)) {
    return rejectedConstraints(ROOM_REJECTION);
  }
  if (occupiesMiniBossArena(sim, slot.entity.id) ||
      miniBossArenaAtPosition(sim.world, body.x, body.y)) {
    return rejectedConstraints(ARENA_REJECTION);
  }
  const occupied = occupiedTiles(sim, slot.entity.id);
  return {
    rejection: null,
    allowsTile: (x, y) => isDungeonTile(sim, x, y),
    isOccupied: (x, y) => occupied.has(tileKey(x, y)),
  };
}

function rejectedConstraints(message: string): RescueConstraints {
  return {
    rejection: message,
    allowsTile: () => false,
    isOccupied: () => false,
  };
}

function isDungeonTile(sim: SimState, x: number, y: number): boolean {
  return !isReservedRoomPosition(y) &&
    miniBossArenaAtPosition(sim.world, x, y) === null;
}

function isReservedRoomPosition(y: number): boolean {
  return isRoomChunk(Math.floor(y / CHUNK_SIZE));
}

function occupiedTiles(sim: SimState, rescuedPlayerId: string): Set<string> {
  const entities = [
    ...otherPlayerEntities(sim, rescuedPlayerId),
    ...livingEnemyEntities(sim),
    ...[...sim.pets.values()].map(({ entity }) => entity),
    ...[...sim.lootChests.values()].map(({ entity }) => entity),
  ];
  return new Set(entities.map(({ body }) =>
    tileKey(Math.floor(body.x), Math.floor(body.y))
  ));
}

function otherPlayerEntities(
  sim: SimState,
  rescuedPlayerId: string,
): Entity[] {
  return [...sim.players.values()]
    .filter((other) =>
      other.connected && other.entity.id !== rescuedPlayerId
    )
    .map(({ entity }) => entity);
}

function livingEnemyEntities(sim: SimState): Entity[] {
  return [...sim.enemies.values()]
    .filter(({ entity }) => entity.hp > 0)
    .map(({ entity }) => entity);
}

function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}
