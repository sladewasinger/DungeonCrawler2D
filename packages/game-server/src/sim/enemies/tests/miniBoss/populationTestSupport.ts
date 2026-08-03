import {
  buildContentRegistry,
  hashString,
  miniBossArenaForChunk,
  miniBossArenaIsStamped,
  TILE,
  World,
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

const content = buildContentRegistry({
  statuses: [...statusesData],
  rules: [...rulesData],
  areas: [...areasData],
  areaReactions: [...areaReactionsData],
  items: [...itemsData],
  enemies: [...enemiesData],
  recipes: [...recipesData],
});

const SEARCH_RADIUS_CHUNKS = 12;
const SEARCH_COORDINATES = Array.from(
  { length: SEARCH_RADIUS_CHUNKS * 2 + 1 },
  (_, index) => index - SEARCH_RADIUS_CHUNKS,
);

export function createMiniBossPopulationSim(seedText: string): SimState {
  const worldSeed = hashString(seedText);
  return createSimState({
    world: new World(worldSeed, 1),
    content,
    store: new PlayerStore(null),
    rngSeed: worldSeed,
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
  for (const chunk of candidateChunks()) {
    const arena = arenaAtChunk(sim, chunk);
    if (arena && matchesComposition(sim, arena, compositionId)) return arena;
  }
  return null;
}

function candidateChunks(): Array<{ readonly cx: number; readonly cy: number }> {
  return SEARCH_COORDINATES.flatMap((cy) =>
    SEARCH_COORDINATES.map((cx) => ({ cx, cy }))
  );
}

function arenaAtChunk(
  sim: SimState,
  chunk: { readonly cx: number; readonly cy: number },
): MiniBossArenaSite | null {
  const arena = miniBossArenaForChunk({
    worldSeed: sim.world.worldSeed,
    floor: sim.world.floor,
    generatedFloor: sim.world.generatedFloor,
    ...chunk,
  });
  return arena && miniBossArenaIsStamped(sim.world, arena) ? arena : null;
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
