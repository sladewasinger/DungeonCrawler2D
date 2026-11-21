import {
  createBody,
  finiteFloorForRuntime,
  LEVEL,
  normalizeFloorGenerationConfig,
  STEP_UP,
  World,
  type BodyState,
  type GeneratedFloor,
} from "@dc2d/engine";

export const SPAWN_X = -12;
export const SPAWN_Y = -26;

let preparedFloor: GeneratedFloor | undefined;
const PREDICTION_WORLD_SEED = 74621;
const PREDICTION_FLOOR_CONFIG = normalizeFloorGenerationConfig({
  roomTargetCount: 8,
  targetLoopCount: 4,
  connectorSpacing: 2,
});

export function sandboxWorld(): World {
  return new World(7, 0, LEVEL.Sandbox);
}

export function openPredictionWorld(): World {
  return new OpenPredictionWorld();
}

export function finitePredictionWorld(): World {
  const floor = preparedFloor ??= finiteFloorForRuntime({
    worldSeed: PREDICTION_WORLD_SEED,
    floor: 1,
    config: PREDICTION_FLOOR_CONFIG,
  });
  return new World(PREDICTION_WORLD_SEED, 1, {
    level: LEVEL.Dungeon,
    generation: PREDICTION_FLOOR_CONFIG,
    generatedFloor: floor,
    expectedGeneration: floor.identity,
  });
}

export function finitePredictionBody(world: World, z = 5): BodyState {
  const spawn = world.generatedFloor?.spawn;
  if (!spawn) throw new Error("finite prediction fixture is missing spawn metadata");
  return createBody(spawn.x + 0.5, spawn.y + 0.5, z);
}

export function closeBody(a: BodyState, b: BodyState, eps = 1e-9): boolean {
  return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps && Math.abs(a.z - b.z) < eps;
}

function isEastWallApproach(world: World, tileX: number, tileY: number): boolean {
  if (!world.isWalkable(tileX, tileY) || !world.isWalkable(tileX + 1, tileY)) return false;
  return world.heightAt(tileX + 1, tileY) - world.heightAt(tileX, tileY) > STEP_UP;
}

function wallApproachAt(world: World, tileX: number, tileY: number): { x: number; y: number; z: number } | null {
  if (!isEastWallApproach(world, tileX, tileY)) return null;
  const x = tileX + 0.5;
  const y = tileY + 0.5;
  return { x, y, z: world.groundAt(x, y) };
}

export function findEastWallApproach(world: World): { x: number; y: number; z: number } {
  for (const { tileX, tileY } of floorTiles(world)) {
    const approach = wallApproachAt(world, tileX, tileY);
    if (approach) return approach;
  }
  throw new Error("seed fixture has no east-facing wall approach");
}

function* floorTiles(world: World): Generator<{ tileX: number; tileY: number }> {
  const bounds = world.floorBounds;
  if (!bounds) {
    yield* nearbyTiles();
    return;
  }
  for (let tileY = bounds.minY; tileY <= bounds.maxY; tileY++) {
    for (let tileX = bounds.minX; tileX <= bounds.maxX; tileX++) yield { tileX, tileY };
  }
}

function* nearbyTiles(): Generator<{ tileX: number; tileY: number }> {
  for (let tileY = -30; tileY <= 30; tileY++) {
    for (let tileX = -30; tileX <= 30; tileX++) yield { tileX, tileY };
  }
}

class OpenPredictionWorld extends World {
  constructor() { super(7, 0, LEVEL.Sandbox); }

  override isWalkable(): boolean { return true; }

  override heightAt(): number { return 0; }

  override groundAt(): number { return 0; }

  override stairHeightAt(): null { return null; }
}
