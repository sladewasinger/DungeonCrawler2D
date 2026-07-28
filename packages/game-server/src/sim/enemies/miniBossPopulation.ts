import {
  hash2D,
  mixSeeds,
  populationRoomsForChunk,
  type PopulationRoom,
} from "@dc2d/engine";
import { spawnEnemy } from "../core/helpers.js";
import type { EnemySlot, SimState } from "../state/state.js";
import { validEnemySpawn } from "./populationPlacement.js";

export const MINI_BOSS_MIN_ROOM_AREA = 55;
const ENCOUNTER_SIZE = 4;
const ORC_WARLORD = "orc-warlord";
const ORC_WARRIOR = "orc-warrior";
const ROOM_SEARCH_OFFSETS = [
  [0, 0], [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [1, -1], [-1, 1], [1, 1],
  [-2, 0], [2, 0], [0, -2], [0, 2],
] as const;
type RoomBounds = Pick<PopulationRoom, "x0" | "y0" | "x1" | "y1">;

function roomKey(room: RoomBounds): string {
  return `${room.x0},${room.y0},${room.x1},${room.y1}`;
}

function encounterExists(sim: SimState, room: PopulationRoom): boolean {
  return [...sim.enemies.values()].some((enemy) =>
    enemy.def.id === ORC_WARLORD && enemy.home !== undefined &&
    roomKey(enemy.home) === roomKey(room)
  );
}

export function markMiniBossDefeated(sim: SimState, enemy: EnemySlot): void {
  if (enemy.def.id !== ORC_WARLORD || !enemy.home) return;
  sim.defeatedMiniBossRooms.add(roomKey(enemy.home));
}

function encounterRoom(
  sim: SimState,
  cx: number,
  cy: number,
): PopulationRoom | null {
  const roll = hash2D(
    mixSeeds(sim.world.worldSeed, sim.world.floor, 0x0bc5),
    cx,
    cy,
  );
  if (roll % 5 !== 0) return null;
  const rooms = populationRoomsForChunk(
    sim.world.worldSeed,
    sim.world.floor,
    cx,
    cy,
  ).filter((room) => room.area >= MINI_BOSS_MIN_ROOM_AREA);
  return rooms[roll % rooms.length] ?? null;
}

interface RoomSpotInput {
  sim: SimState;
  room: PopulationRoom;
  desired: { x: number; y: number };
  claimed: Set<string>;
}

function roomSpot(input: RoomSpotInput): { x: number; y: number } | null {
  const { sim, room, desired, claimed } = input;
  for (const [dx, dy] of ROOM_SEARCH_OFFSETS) {
    const x = Math.floor(desired.x + dx);
    const y = Math.floor(desired.y + dy);
    const key = `${x},${y}`;
    if (x < room.x0 || x > room.x1 || y < room.y0 || y > room.y1) continue;
    if (claimed.has(key) || !validEnemySpawn(sim, x, y)) continue;
    claimed.add(key);
    return { x: x + 0.5, y: y + 0.5 };
  }
  return null;
}

function encounterSpots(
  sim: SimState,
  room: PopulationRoom,
): Array<{ x: number; y: number }> | null {
  const x = (room.x0 + room.x1) / 2;
  const y = (room.y0 + room.y1) / 2;
  const desired = [
    { x, y }, { x: x - 3, y }, { x: x + 3, y }, { x, y: y + 3 },
  ];
  const claimed = new Set<string>();
  const spots = desired.map((spot) => roomSpot({ sim, room, desired: spot, claimed }));
  return spots.every((spot) => spot !== null)
    ? spots as Array<{ x: number; y: number }>
    : null;
}

export function spawnMiniBossEncounter(
  sim: SimState,
  cx: number,
  cy: number,
): boolean {
  if (sim.enemies.size > 150 - ENCOUNTER_SIZE) return false;
  const room = encounterRoom(sim, cx, cy);
  if (!room) return false;
  if (sim.defeatedMiniBossRooms.has(roomKey(room)) || encounterExists(sim, room)) {
    return false;
  }
  const spots = encounterSpots(sim, room);
  if (!spots) return false;
  const defs = [ORC_WARLORD, ORC_WARRIOR, "orc-shaman", "masked-orc"];
  spots.forEach((spot, index) => {
    spawnEnemy(sim, { defId: defs[index]!, x: spot.x, y: spot.y, home: room });
  });
  return true;
}
