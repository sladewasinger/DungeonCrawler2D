import { describe, expect, it } from "vitest";
import { BEDROCK_MIN_HEIGHT, CHUNK_SIZE, TILE } from "../../core/types.js";
import {
  carveAt,
  createFloorBuffers,
  forEachCell,
  localIndex,
  materializeBuffers,
  stampSolid,
} from "../finiteFloorBuffers.js";
import { applyElevationTransitions } from "../finiteFloorElevation.js";
import { analyzeFloorMovement } from "../finiteFloorMovement.js";
import { generateFiniteFloor, sliceGeneratedFloorChunk } from "../finiteFloor.js";
import { FINITE_GENERATOR_VERSION, FLOOR_SEMANTIC, type FloorBounds, type FloorBuffers } from "../finiteFloorTypes.js";
import {
  ordinaryBoundaryTop,
  ordinaryBoundaryVisibilityIsValid,
  ORDINARY_WALL_VISIBILITY_MARGIN,
} from "./ordinaryElevationVisibility.js";
import { scanPhysicalOrdinaryInterfaces } from "./ordinaryElevationVisibilityTestSupport.js";

describe("ordinary elevation visibility", () => {
  it.each([
    { minimumElevation: -2, maximumElevation: 0 },
    { minimumElevation: -4, maximumElevation: -1 },
  ])("bounds cardinal wall margins across supported elevation ranges", (range) => {
    const bounds = visibilityBounds();
    const buffers = visibilityFixture(bounds);
    buffers.protectedCells[localIndex({ bounds, x: 17, y: 0 })] = 1;
    applyElevationTransitions({
      buffers, bounds, safeRooms: [], stairways: { down: [], up: null }, miniBossArenas: [],
      shapeOrdinaryWallMargins: true, elevationStep: 1, ...range,
    });
    materializeBuffers({ buffers, bounds, voidTerrain: false });

    const wallIndex = localIndex({ bounds, x: 18, y: 0 });
    const neighborPoints: readonly [number, number][] = [[17, 0], [19, 0], [18, -1], [18, 1]];
    const neighborIndices = neighborPoints.map(([x, y]) => localIndex({ bounds, x, y }));
    expect(neighborIndices.map((index) => buffers.height[index])).toEqual(
      Array.from({ length: 4 }, () => 0),
    );
    expect(buffers.height[wallIndex]).toBeGreaterThanOrEqual(BEDROCK_MIN_HEIGHT);
    expect(neighborIndices.every((index) =>
      (buffers.height[wallIndex] ?? 0) - (buffers.height[index] ?? 0)
        <= ORDINARY_WALL_VISIBILITY_MARGIN)).toBe(true);
    expect(ordinaryBoundaryVisibilityIsValid(buffers, bounds, wallIndex)).toBe(true);
    const cornerWallPoints: readonly [number, number][] = [[-18, -19], [-19, -18]];
    const cornerWalls = cornerWallPoints.map(([x, y]) => localIndex({ bounds, x, y }));
    expect(cornerWalls.every((index) => ordinaryBoundaryVisibilityIsValid(buffers, bounds, index))).toBe(true);
    expect(Array.from(buffers.height).some((height) => height === range.minimumElevation)).toBe(true);
  });

  it("keeps authored wall geometry outside ordinary wall resolution", () => {
    const bounds = smallBounds();
    const buffers = createFloorBuffers(bounds);
    const roomWall = localIndex({ bounds, x: 0, y: 0 });
    const spawnWall = localIndex({ bounds, x: 1, y: 0 });
    buffers.semantic[roomWall] = FLOOR_SEMANTIC.RoomWall;
    buffers.semantic[spawnWall] = FLOOR_SEMANTIC.SpawnExterior;
    buffers.protectedCells[roomWall] = 1;
    buffers.protectedCells[spawnWall] = 1;

    materializeBuffers({ buffers, bounds, voidTerrain: false });

    expect(buffers.height[roomWall]).toBe(2);
    expect(buffers.height[spawnWall]).toBe(3);
    expect(ordinaryBoundaryTop(buffers, bounds, roomWall)).toBeNull();
    expect(ordinaryBoundaryTop(buffers, bounds, spawnWall)).toBeNull();
  });

  it("preserves deterministic playable negative terrain across ordinary interfaces", () => {
    const floors = [74622, 74623, 74624].map((worldSeed) => generateFiniteFloor({
      worldSeed, floor: 1, features: { voidTerrain: false },
    }));
    for (const floor of floors) assertPlayableVisibleFloor(floor);
    const lowered = generateFiniteFloor({
      worldSeed: 74622, floor: 1, features: { voidTerrain: false },
      config: { minimumElevation: -4, maximumElevation: -1 },
    });
    assertPlayableVisibleFloor(lowered);
    assertSlicedBedrockMinimum(lowered);
    const floor = floors[0];
    if (!floor) throw new Error("missing deterministic elevation fixture");
    const repeated = generateFiniteFloor({ worldSeed: 74622, floor: 1, features: { voidTerrain: false } });

    expect(floor.bounds).toEqual(repeated.bounds);
    expect(floor.height).toEqual(repeated.height);
    expect(floor.identity.fingerprint).toBe(repeated.identity.fingerprint);
    expect(floor.identity.generatorVersion).toBe(FINITE_GENERATOR_VERSION);
  }, 30_000);
});

function visibilityFixture(bounds: FloorBounds): FloorBuffers {
  const buffers = createFloorBuffers(bounds);
  forEachCell(bounds, (x, y) => {
    carveAt({ buffers, bounds, point: { x, y }, semantic: FLOOR_SEMANTIC.Corridor, regionId: 1 });
  });
  carveAt({ buffers, bounds, point: { x: 0, y: 0 }, semantic: FLOOR_SEMANTIC.SpawnExterior, regionId: 1 });
  stampSolid({ buffers, bounds, x: 18, y: 0 });
  stampSolid({ buffers, bounds, x: -18, y: -19 });
  stampSolid({ buffers, bounds, x: -19, y: -18 });
  return buffers;
}

function visibilityBounds(): FloorBounds {
  return {
    minX: -20, minY: -20, width: 41, height: 41, maxX: 20, maxY: 20,
    minChunkX: -1, minChunkY: -1, maxChunkX: 0, maxChunkY: 0,
  };
}

function smallBounds(): FloorBounds {
  return {
    minX: 0, minY: 0, width: 2, height: 1, maxX: 1, maxY: 0,
    minChunkX: 0, minChunkY: 0, maxChunkX: 0, maxChunkY: 0,
  };
}

function ordinaryHeights(buffers: FloorBuffers): number[] {
  return Array.from(buffers.height).filter((_height, index) =>
    buffers.tiles[index] === TILE.Floor && (
      buffers.semantic[index] === FLOOR_SEMANTIC.Corridor
      || buffers.semantic[index] === FLOOR_SEMANTIC.Room
      || buffers.semantic[index] === FLOOR_SEMANTIC.Transition
    ));
}

function assertPlayableVisibleFloor(floor: ReturnType<typeof generateFiniteFloor>): void {
  const physicalInterfaces = scanPhysicalOrdinaryInterfaces(floor, floor.bounds);
  let ordinaryBoundaries = 0;
  forEachCell(floor.bounds, (_x, _y, index) => {
    if (ordinaryBoundaryTop(floor, floor.bounds, index) === null) return;
    ordinaryBoundaries++;
    expect(ordinaryBoundaryVisibilityIsValid(floor, floor.bounds, index)).toBe(true);
  });
  expect(ordinaryBoundaries).toBeGreaterThan(0);
  expect(physicalInterfaces.protectedInterfaceCount).toBeGreaterThan(0);
  expect(physicalInterfaces.violationCount).toBe(0);
  expect(physicalInterfaces.maximumFaceHeight).toBeLessThanOrEqual(ORDINARY_WALL_VISIBILITY_MARGIN);
  expect(ordinaryHeights(floor).some((height) => height < 0)).toBe(true);
  expect(Array.from(floor.height).every(Number.isFinite)).toBe(true);
  expect(floor.tiles.every((tile, index) =>
    tile !== TILE.Bedrock || (floor.height[index] ?? 0) >= BEDROCK_MIN_HEIGHT)).toBe(true);
  expect(analyzeFloorMovement({ buffers: floor, spawn: floor.spawn }, floor.bounds).failures).toEqual([]);
}

function assertSlicedBedrockMinimum(floor: ReturnType<typeof generateFiniteFloor>): void {
  for (let cy = floor.bounds.minChunkY; cy <= floor.bounds.maxChunkY; cy++) {
    for (let cx = floor.bounds.minChunkX; cx <= floor.bounds.maxChunkX; cx++) {
      const chunk = sliceGeneratedFloorChunk(floor, cx, cy);
      expect(chunk.tiles.every((tile, index) =>
        tile !== TILE.Bedrock || (chunk.height[index] ?? 0) >= BEDROCK_MIN_HEIGHT)).toBe(true);
      expect(chunk.tiles).toHaveLength(CHUNK_SIZE * CHUNK_SIZE);
    }
  }
}
