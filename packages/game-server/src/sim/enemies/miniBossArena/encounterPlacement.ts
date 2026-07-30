import type { MiniBossArenaSite } from "@dc2d/engine";
import type { SimState } from "../../state/state.js";
import {
  miniBossEncounterForArena,
  type MiniBossEncounterComposition,
} from "./encounterComposition.js";

const ENCOUNTER_OFFSETS = [
  [0, 0],
  [-2, 0],
  [2, 0],
  [0, 2],
] as const;
const SPOT_OFFSETS = [
  [0, 0],
  [-1, 0],
  [1, 0],
  [0, 1],
  [0, -1],
] as const;

export interface MiniBossEncounterMember {
  readonly defId: string;
  readonly x: number;
  readonly y: number;
  readonly arenaLeader?: true;
}

export interface MiniBossEncounterPlacement {
  readonly sim: SimState;
  readonly arena: MiniBossArenaSite;
  readonly maximumEnemies: number;
}

/** Returns the complete encounter, or nothing when the cap/arena cannot hold it. */
export function miniBossEncounterMembers(
  input: MiniBossEncounterPlacement,
): readonly MiniBossEncounterMember[] {
  const { sim, arena, maximumEnemies } = input;
  const composition = miniBossEncounterForArena({
    worldSeed: sim.world.worldSeed,
    floor: sim.world.floor,
    arena,
  });
  const defIds = encounterDefIds(sim, composition, maximumEnemies);
  if (defIds.length === 0) return [];
  const spots = encounterSpots(sim, arena, defIds.length);
  if (spots.length !== defIds.length) return [];
  return spots.map((spot, index) => ({
    defId: defIds[index]!,
    x: spot.x,
    y: spot.y,
    ...(index === 0 ? { arenaLeader: true } : {}),
  }));
}

function encounterDefIds(
  sim: SimState,
  composition: MiniBossEncounterComposition,
  maximumEnemies: number,
): readonly string[] {
  const defIds = [composition.leaderDefId, ...composition.minionDefIds];
  const availableSlots = maximumEnemies - sim.enemies.size;
  return availableSlots >= defIds.length ? defIds : [];
}

function encounterSpots(
  sim: SimState,
  arena: MiniBossArenaSite,
  count: number,
): Array<{ x: number; y: number }> {
  const claimed = new Set<string>();
  const spots: Array<{ x: number; y: number }> = [];
  for (const [dx, dy] of ENCOUNTER_OFFSETS.slice(0, count)) {
    const spot = arenaSpot({
      sim,
      arena,
      desired: { x: arena.center.x + dx, y: arena.center.y + dy },
      claimed,
    });
    if (!spot) return [];
    spots.push(spot);
  }
  return spots;
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
