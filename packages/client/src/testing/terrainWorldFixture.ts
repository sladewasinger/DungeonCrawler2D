import {
  LEVEL,
  TILE,
  World,
  finiteFloorForRuntime,
  normalizeFloorGenerationConfig,
  type FloorBounds,
  type GeneratedFloor,
  type TileType,
} from "@dc2d/engine";

const FIXTURE_SEED = 74621;
const FIXTURE_FLOOR = 1;
const FIXTURE_GENERATION = normalizeFloorGenerationConfig({
  roomTargetCount: 8,
  targetLoopCount: 4,
  connectorSpacing: 2,
});
const PREPARED_FLOORS = new Map<boolean, GeneratedFloor>();

export interface FiniteTerrainWorldFixture {
  readonly world: World;
  readonly spawn: Readonly<{ x: number; y: number }>;
  readonly downStairway: Readonly<{ x: number; y: number }>;
  readonly miniBossArenaCenters: readonly Readonly<{ x: number; y: number }>[];
}

export function finiteTerrainWorldFixture(
  voidTerrain = true,
): FiniteTerrainWorldFixture {
  const floor = preparedFloor(voidTerrain);
  const world = new World(FIXTURE_SEED, FIXTURE_FLOOR, {
    features: { voidTerrain },
    generation: FIXTURE_GENERATION,
    generatedFloor: floor,
    expectedGeneration: floor.identity,
  });
  return {
    world,
    spawn: copyPoint(floor.spawn),
    downStairway: copyPoint(requiredDownStairway(floor).position),
    miniBossArenaCenters: floor.miniBossArenas.map(({ center }) => copyPoint(center)),
  };
}

export function authoredTerrainWorldFixture(): World {
  return new World(FIXTURE_SEED, 0, LEVEL.Sandbox);
}

export function terminalTerrainWorldFixture(): World {
  return new World(FIXTURE_SEED, 5, LEVEL.CombatSandbox);
}

export function staticTileWorldFixture(tile: TileType = TILE.Floor): World {
  return new StaticTileWorld(tile);
}

class StaticTileWorld extends World {
  constructor(private readonly fixtureTile: TileType) {
    super(FIXTURE_SEED, 0, LEVEL.CombatSandbox);
  }

  override tileAt(): TileType {
    return this.fixtureTile;
  }

  override featureAt(): TileType {
    return this.fixtureTile;
  }
}

function preparedFloor(voidTerrain: boolean): GeneratedFloor {
  const cached = PREPARED_FLOORS.get(voidTerrain);
  if (cached) return cached;
  const floor = finiteFloorForRuntime({
    worldSeed: FIXTURE_SEED,
    floor: FIXTURE_FLOOR,
    features: { voidTerrain },
    config: FIXTURE_GENERATION,
  });
  assertCanonicalMetadata(floor);
  PREPARED_FLOORS.set(voidTerrain, floor);
  return floor;
}

function assertCanonicalMetadata(floor: GeneratedFloor): void {
  assertBounds(floor.bounds, "finite floor");
  assertBounds(floor.identity?.bounds, "generation identity");
  if (!floor.identity?.fingerprint || !floor.identity.configurationFingerprint) {
    throw new Error("Finite terrain fixture is missing generation identity");
  }
  if (!sameBounds(floor.bounds, floor.identity.bounds)) {
    throw new Error("Finite terrain fixture bounds do not match its generation identity");
  }
  requiredDownStairway(floor);
  if (floor.safeRooms.length === 0 || floor.miniBossArenas.length < 2) {
    throw new Error("Finite terrain fixture is missing required landmark metadata");
  }
}

function requiredDownStairway(floor: GeneratedFloor) {
  const stairway = floor.downStairways[0];
  if (!stairway) throw new Error("Finite terrain fixture is missing a down stairway");
  return stairway;
}

function assertBounds(bounds: FloorBounds | undefined, label: string): asserts bounds is FloorBounds {
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
    throw new Error(`Finite terrain fixture is missing valid ${label} bounds`);
  }
}

function sameBounds(left: FloorBounds, right: FloorBounds): boolean {
  return left.minX === right.minX && left.minY === right.minY &&
    left.width === right.width && left.height === right.height &&
    left.maxX === right.maxX && left.maxY === right.maxY;
}

function copyPoint(point: { readonly x: number; readonly y: number }) {
  return Object.freeze({ x: point.x, y: point.y });
}
