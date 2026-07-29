import {
  miniBossArenaIsStamped,
  miniBossArenaForChunk,
  type MiniBossArenaSite,
} from "@dc2d/engine";
import { spawnEnemy } from "../../core/helpers.js";
import type { EnemySlot, SimState } from "../../state/state.js";
import { clearMiniBossArena } from "./runtime.js";

const ENCOUNTER_SIZE = 4;
const ENEMY_CAP = 150;
const ORC_WARLORD = "orc-warlord";
const ENCOUNTER_DEFS = [
  ORC_WARLORD,
  "orc-warrior",
  "orc-shaman",
  "masked-orc",
] as const;
const SPOT_OFFSETS = [
  [0, 0],
  [-1, 0],
  [1, 0],
  [0, 1],
  [0, -1],
] as const;

export function handleMiniBossEnemyDeath(
  sim: SimState,
  enemy: EnemySlot,
): void {
  const arenaKey = enemy.arenaKey;
  if (!arenaKey || encounterExists(sim, arenaKey)) return;
  sim.defeatedMiniBossArenas.add(arenaKey);
  clearMiniBossArena(sim, arenaKey);
}

export function spawnMiniBossEncounter(
  sim: SimState,
  cx: number,
  cy: number,
): boolean {
  if (sim.enemies.size > ENEMY_CAP - ENCOUNTER_SIZE) return false;
  const arena = miniBossArenaForChunk({
    worldSeed: sim.world.worldSeed,
    floor: sim.world.floor,
    cx,
    cy,
  });
  if (!arena ||
      !miniBossArenaIsStamped(sim.world, arena) ||
      encounterUnavailable(sim, arena)) return false;
  const spots = encounterSpots(sim, arena);
  if (!spots) return false;
  for (let index = 0; index < ENCOUNTER_DEFS.length; index++) {
    const spot = spots[index]!;
    spawnEnemy(sim, {
      defId: ENCOUNTER_DEFS[index]!,
      x: spot.x,
      y: spot.y,
      home: arena.interior,
      arenaKey: arena.key,
    });
  }
  return true;
}

export function miniBossEncounterAlive(
  sim: SimState,
  arenaKey: string,
): boolean {
  return encounterExists(sim, arenaKey);
}

function encounterUnavailable(
  sim: SimState,
  arena: MiniBossArenaSite,
): boolean {
  return sim.defeatedMiniBossArenas.has(arena.key) ||
    encounterExists(sim, arena.key);
}

function encounterExists(sim: SimState, arenaKey: string): boolean {
  return [...sim.enemies.values()].some((enemy) =>
    enemy.arenaKey === arenaKey
  );
}

function encounterSpots(
  sim: SimState,
  arena: MiniBossArenaSite,
): Array<{ x: number; y: number }> | null {
  const desired = [
    arena.center,
    { x: arena.center.x - 2, y: arena.center.y },
    { x: arena.center.x + 2, y: arena.center.y },
    { x: arena.center.x, y: arena.center.y + 2 },
  ];
  const claimed = new Set<string>();
  const spots = desired.map((point) =>
    arenaSpot({ sim, arena, desired: point, claimed })
  );
  return spots.every((spot) => spot !== null)
    ? spots as Array<{ x: number; y: number }>
    : null;
}

interface ArenaSpotInput {
  readonly sim: SimState;
  readonly arena: MiniBossArenaSite;
  readonly desired: { readonly x: number; readonly y: number };
  readonly claimed: Set<string>;
}

function arenaSpot(input: ArenaSpotInput): { x: number; y: number } | null {
  const { sim, arena, desired, claimed } = input;
  for (const [dx, dy] of SPOT_OFFSETS) {
    const x = desired.x + dx;
    const y = desired.y + dy;
    const key = `${x},${y}`;
    if (!insideArena(arena, x, y) || claimed.has(key)) continue;
    if (!sim.world.isWalkable(x, y) || sim.world.isSanctuary(x, y)) continue;
    claimed.add(key);
    return { x: x + 0.5, y: y + 0.5 };
  }
  return null;
}

function insideArena(
  arena: MiniBossArenaSite,
  x: number,
  y: number,
): boolean {
  return x >= arena.interior.x0 && x <= arena.interior.x1 &&
    y >= arena.interior.y0 && y <= arena.interior.y1;
}
