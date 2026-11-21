import { LEVEL, type LevelId } from "../level.js";
import { World } from "../world.js";
import type { WorldFeatures } from "../worldFeatures.js";
import {
  finiteFloorForRuntime,
  normalizeFloorGenerationConfig,
  type GeneratedFloor,
} from "../../generate/finiteFloor.js";

export const FINITE_WORLD_FIXTURE_SEED = 74621;
const FINITE_WORLD_FIXTURE_FLOOR = 1;
const FINITE_WORLD_FIXTURE_CONFIG = normalizeFloorGenerationConfig({
  roomTargetCount: 8,
  targetLoopCount: 4,
  connectorSpacing: 2,
});
const FLOOR_BY_TERRAIN_MODE = new Map<boolean, GeneratedFloor>();

export interface FiniteWorldFixtureOptions {
  readonly level?: LevelId;
  readonly features?: WorldFeatures;
  readonly voidTerrain?: boolean;
}

export function finiteWorldFixture(options: FiniteWorldFixtureOptions = {}): World {
  const voidTerrain = options.features?.voidTerrain ?? options.voidTerrain ?? true;
  const floor = finiteWorldFixtureFloor(voidTerrain);
  return new World(FINITE_WORLD_FIXTURE_SEED, FINITE_WORLD_FIXTURE_FLOOR, {
    level: options.level ?? LEVEL.Dungeon,
    features: options.features ?? { voidTerrain },
    generation: FINITE_WORLD_FIXTURE_CONFIG,
    generatedFloor: floor,
    expectedGeneration: floor.identity,
  });
}

export function finiteWorldFixtureFloor(voidTerrain = true): GeneratedFloor {
  const existing = FLOOR_BY_TERRAIN_MODE.get(voidTerrain);
  if (existing) return existing;
  const floor = finiteFloorForRuntime({
    worldSeed: FINITE_WORLD_FIXTURE_SEED,
    floor: FINITE_WORLD_FIXTURE_FLOOR,
    features: { voidTerrain },
    config: FINITE_WORLD_FIXTURE_CONFIG,
  });
  FLOOR_BY_TERRAIN_MODE.set(voidTerrain, floor);
  return floor;
}
