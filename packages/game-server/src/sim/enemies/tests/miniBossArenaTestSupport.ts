import {
  buildContentRegistry,
  createBody,
  hashString,
  makeEntity,
  miniBossArenaForChunk,
  World,
  type MiniBossArenaSite,
} from "@dc2d/engine";
import {
  areasData,
  enemiesData,
  itemsData,
  recipesData,
  rulesData,
  statusesData,
} from "@dc2d/content";
import { PlayerStore } from "../../../store.js";
import {
  createSimState,
  type PlayerSlot,
  type SimState,
} from "../../state/state.js";
import { createPlayerSlot } from "../../players/joinSlot.js";
import { spawnMiniBossEncounter } from "../miniBossArena/population.js";

const content = buildContentRegistry({
  statuses: [...statusesData],
  rules: [...rulesData],
  areas: [...areasData],
  items: [...itemsData],
  enemies: [...enemiesData],
  recipes: [...recipesData],
});

export function createMiniBossArenaSim(): SimState {
  const seed = hashString("mini-boss-gate");
  return createSimState({
    world: new World(seed, 1),
    content,
    store: new PlayerStore(null),
    rngSeed: seed,
    opts: {},
  });
}

export function spawnTestArena(sim: SimState): MiniBossArenaSite {
  for (const chunk of candidateChunks()) {
    const arena = spawnArenaInChunk(sim, chunk);
    if (arena) return arena;
  }
  throw new Error("test seed produced no mini-boss arena");
}

export function addArenaPlayer(
  sim: SimState,
  id: string,
  position: { readonly x: number; readonly y: number },
): PlayerSlot {
  const entity = makeEntity(
    "player",
    createBody(position.x, position.y, 0),
    { id, name: id, hp: 30, maxHp: 30 },
  );
  const slot = createPlayerSlot({
    entity,
    clientId: `client-${id}`,
    stored: sim.store.get(`client-${id}`, id),
    resumeToken: `token-${id}`,
    tick: sim.tickCount,
  });
  sim.players.set(id, slot);
  return slot;
}

function candidateChunks(): Array<{ x: number; y: number }> {
  const coordinates = Array.from({ length: 21 }, (_, index) => index - 10);
  return coordinates.flatMap((y) =>
    coordinates.map((x) => ({ x, y }))
  );
}

function spawnArenaInChunk(
  sim: SimState,
  chunk: { readonly x: number; readonly y: number },
): MiniBossArenaSite | null {
  if (!spawnMiniBossEncounter(sim, chunk.x, chunk.y)) return null;
  return miniBossArenaForChunk({
    worldSeed: sim.world.worldSeed,
    floor: sim.world.floor,
    cx: chunk.x,
    cy: chunk.y,
  });
}
