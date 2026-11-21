import {
  buildContentRegistry,
  hashString,
  miniBossArenaIsStamped,
  TILE,
  type MiniBossArenaSite,
} from "@dc2d/engine";
import {
  areaReactionsData,
  areasData,
  enemiesData,
  itemsData,
  recipesData,
  rulesData,
  statusesData,
} from "@dc2d/content";
import { PlayerStore } from "../../../../store.js";
import { createSimState, type EnemySlot, type SimState } from "../../../state/state.js";
import {
  miniBossEncounterForArena,
  type MiniBossEncounterId,
} from "../../miniBossArena/encounterComposition.js";
import { spawnMiniBossEncounter } from "../../miniBossArena/population.js";
import { finiteServerWorldFixture } from "../../../testing/finiteWorldTestSupport.js";

const content = buildContentRegistry({
  statuses: [...statusesData],
  rules: [...rulesData],
  areas: [...areasData],
  areaReactions: [...areaReactionsData],
  items: [...itemsData],
  enemies: [...enemiesData],
  recipes: [...recipesData],
});

export function createMiniBossPopulationSim(seedText: string): SimState {
  return createSimState({
    world: finiteServerWorldFixture(),
    content,
    store: new PlayerStore(null),
    rngSeed: hashString(seedText),
    opts: {},
  });
}

export function spawnMiniBossPopulationEncounter(
  sim: SimState,
  compositionId?: MiniBossEncounterId,
): MiniBossArenaSite {
  const arena = findMiniBossPopulationArena(sim, compositionId);
  if (!arena || !spawnMiniBossEncounter(sim, arena.chunk.cx, arena.chunk.cy)) {
    throw new Error("no mini-boss encounter spawned");
  }
  return arena;
}

export function blockArenaInterior(
  sim: SimState,
  arena: MiniBossArenaSite,
): void {
  const overrides: Array<{
    x: number;
    y: number;
    tile: typeof TILE.CraftingTable;
  }> = [];
  for (let y = arena.interior.y0; y <= arena.interior.y1; y++) {
    for (let x = arena.interior.x0; x <= arena.interior.x1; x++) {
      overrides.push({ x, y, tile: TILE.CraftingTable });
    }
  }
  sim.world.replaceTileOverrides(overrides);
}

export function findMiniBossPopulationArena(
  sim: SimState,
  compositionId?: MiniBossEncounterId,
): MiniBossArenaSite | null {
  return matchingArena(sim, compositionId);
}

export function requireMiniBossArenaLeader(sim: SimState): EnemySlot {
  const leader = [...sim.enemies.values()].find((enemy) => enemy.arenaLeader);
  if (!leader) throw new Error("missing arena leader");
  return leader;
}

function matchingArena(
  sim: SimState,
  compositionId: MiniBossEncounterId | undefined,
): MiniBossArenaSite | null {
  for (const arena of generatedArenas(sim)) {
    if (arena && matchesComposition(sim, arena, compositionId)) return arena;
  }
  return null;
}

function generatedArenas(sim: SimState): readonly MiniBossArenaSite[] {
  const arenas = sim.world.generatedFloor?.miniBossArenas ?? [];
  return arenas.filter((arena) => miniBossArenaIsStamped(sim.world, arena));
}

function matchesComposition(
  sim: SimState,
  arena: MiniBossArenaSite,
  compositionId: MiniBossEncounterId | undefined,
): boolean {
  return compositionId === undefined || miniBossEncounterForArena({
    worldSeed: sim.world.worldSeed,
    floor: sim.world.floor,
    arena,
  }).id === compositionId;
}
