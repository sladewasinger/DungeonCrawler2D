import {
  LEVEL,
  World,
  type GeneratedFloor,
  type LevelId,
} from "@dc2d/engine";
import { loadIntegrationDungeonFixture } from "../integration/support/finiteFloorFixture.js";

export const SERVER_FINITE_FIXTURE_SEED = 74621;
const PREPARED_FLOORS = new Map<string, GeneratedFloor>();

export function finiteServerWorldFixture(
  floorNumber = 1,
  worldSeed = SERVER_FINITE_FIXTURE_SEED,
): World {
  const floor = finiteServerFloorFixture(floorNumber, worldSeed);
  return new World(worldSeed, floorNumber, {
    level: LEVEL.Dungeon,
    generatedFloor: floor,
    expectedGeneration: floor.identity,
  });
}

export function finiteServerFloorFixture(
  floorNumber = 1,
  worldSeed = SERVER_FINITE_FIXTURE_SEED,
): GeneratedFloor {
  const key = `${worldSeed}:${floorNumber}`;
  const cached = PREPARED_FLOORS.get(key);
  if (cached) return cached;
  const floor = loadIntegrationDungeonFixture(
    worldSeed,
    floorNumber,
  );
  assertFiniteFixture(floor);
  PREPARED_FLOORS.set(key, floor);
  return floor;
}

export function authoredServerWorldFixture(
  level: Exclude<LevelId, typeof LEVEL.Dungeon> = LEVEL.Sandbox,
  floorNumber = 0,
): World {
  if (level === LEVEL.Sandbox && floorNumber !== 0) {
    throw new Error("Sandbox fixtures must use the authored floor-zero contract");
  }
  return new World(SERVER_FINITE_FIXTURE_SEED, floorNumber, level);
}

export function finiteFixtureSpawn(world: World): { x: number; y: number } {
  const spawn = world.generatedFloor?.spawn;
  if (!spawn) throw new Error("Server finite fixture is missing its spawn");
  return { x: spawn.x, y: spawn.y };
}

function assertFiniteFixture(floor: GeneratedFloor): void {
  if (!floor.identity?.fingerprint || !floor.identity.configurationFingerprint) {
    throw new Error("Server finite fixture is missing generation identity");
  }
  if (floor.bounds.width <= 0 || floor.bounds.height <= 0) {
    throw new Error("Server finite fixture is missing valid bounds");
  }
  if (floor.downStairways.length === 0 || floor.rooms.length === 0) {
    throw new Error("Server finite fixture is missing stairs or rooms");
  }
}
