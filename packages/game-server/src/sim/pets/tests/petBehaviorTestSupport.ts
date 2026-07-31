import {
  LEVEL,
  World,
  buildContentRegistry,
  hashString,
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
import { expect } from "vitest";
import { PlayerStore } from "../../../store.js";
import { addPlayer } from "../../players/join.js";
import { createSimState } from "../../state/state.js";
import { PET_DEFINITIONS, claimNearestPet, spawnPet, stepPets } from "../index.js";

const content = buildContentRegistry({
  statuses: [...statusesData],
  rules: [...rulesData],
  areas: [...areasData],
  areaReactions: [...areaReactionsData],
  items: [...itemsData],
  enemies: [...enemiesData],
  recipes: [...recipesData],
});

export const TARD_ID = "pet-dino-tard";

export function claimedPet(definitionId: string) {
  const sim = createPetBehaviorSim(definitionId);
  sim.pets.clear();
  const joined = addPlayer(sim, { name: "Owner", clientId: `behavior-${definitionId}` });
  const owner = sim.players.get(joined.playerId)!;
  const definition = PET_DEFINITIONS.find((candidate) => candidate.id === definitionId)!;
  const entity = spawnPet(sim, {
    definition,
    position: { x: owner.entity.body.x + 1, y: owner.entity.body.y },
  });
  expect(claimNearestPet(sim, owner)).toBe(true);
  return { sim, owner, pet: sim.pets.get(entity.id)! };
}

export function advancePets(sim: ReturnType<typeof createSimState>, ticks: number): void {
  for (let tick = 0; tick < ticks; tick++) {
    sim.tickCount++;
    stepPets(sim);
  }
}

export function forceRandom(sim: ReturnType<typeof createSimState>, value: number): void {
  Object.defineProperty(sim.rng, "next", {
    configurable: true,
    value: () => value,
  });
}

function createPetBehaviorSim(definitionId: string) {
  return createSimState({
    world: new World(hashString(`pet-behavior-${definitionId}`), 1, LEVEL.Dungeon),
    content,
    store: new PlayerStore(null),
    rngSeed: 7,
    opts: { spawnRadiusTiles: 2 },
  });
}
