import {
  areasData,
  areaReactionsData,
  enemiesData,
  itemsData,
  recipesData,
  rulesData,
  statusesData,
} from "@dc2d/content";
import {
  buildContentRegistry,
  hashString,
  type ContentRegistry,
  type GeneratedFloor,
} from "@dc2d/engine";
import { loadIntegrationDungeonFixture } from "../sim/integration/support/finiteFloorFixture.js";
import { PlayerStore } from "../store.js";
import { FloorRegistry } from "./floorRegistry.js";

export const FLOOR_REGISTRY_TEST_SEED = hashString("floor-registry-fixture");
export const floorRegistryTestContent: ContentRegistry = buildContentRegistry({
  statuses: [...statusesData],
  rules: [...rulesData],
  areas: [...areasData],
  areaReactions: [...areaReactionsData],
  items: [...itemsData],
  enemies: [...enemiesData],
  recipes: [...recipesData],
});

export interface FloorRegistryFixtureInput {
  readonly floors?: readonly number[];
  readonly store?: PlayerStore;
  readonly prewarmNextFloor?: boolean;
  readonly seed?: number;
}

export function createFloorRegistryFixture(
  input: FloorRegistryFixtureInput = {},
): FloorRegistry {
  const seed = input.seed ?? FLOOR_REGISTRY_TEST_SEED;
  const prebuiltFloors = input.floors
    ? preparedFloorFixtures(seed, input.floors)
    : undefined;
  return new FloorRegistry({
    worldSeed: seed,
    content: floorRegistryTestContent,
    store: input.store ?? new PlayerStore(null),
    rngSeedBase: 1,
    opts: {},
    ...(input.prewarmNextFloor !== undefined
      ? { prewarmNextFloor: input.prewarmNextFloor }
      : {}),
    ...(prebuiltFloors ? { prebuiltFloors } : {}),
  });
}

export function preparedFloorFixtures(
  seed: number,
  floors: readonly number[],
): ReadonlyMap<number, GeneratedFloor> {
  return new Map(floors.map((floor) => [
    floor,
    loadIntegrationDungeonFixture(seed, floor),
  ]));
}

export async function disposeFloorRegistryFixture(
  registry: FloorRegistry,
): Promise<void> {
  try {
    await registry.waitForPendingFloorPreparations();
  } finally {
    await registry.dispose();
  }
}
