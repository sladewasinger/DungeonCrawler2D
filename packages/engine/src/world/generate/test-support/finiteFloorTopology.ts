import { carveAt, createFloorBuffers } from "../finiteFloorBuffers.js";
import { DEFAULT_FLOOR_GENERATION_CONFIG, FLOOR_SEMANTIC, type FloorAttempt, type FloorBounds, type FloorBuffers } from "../finiteFloorTypes.js";

export function smallMovementBounds(): FloorBounds {
  return {
    minX: 0, minY: 0, width: 3, height: 3, maxX: 2, maxY: 2,
    minChunkX: 0, minChunkY: 0, maxChunkX: 0, maxChunkY: 0,
  };
}

export function carveTestPlane(buffers: ReturnType<typeof createFloorBuffers>, bounds: FloorBounds): void {
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      carveAt({ buffers, bounds, point: { x, y }, semantic: FLOOR_SEMANTIC.Corridor, regionId: 1 });
    }
  }
}

export function testAttempt(buffers: ReturnType<typeof createFloorBuffers>): FloorAttempt {
  return {
    buffers,
    rooms: [], connectors: [], routes: [], featureStamps: [], downStairways: [], upStairway: null,
    safeRooms: [], miniBossArenas: [], bossArena: null, spawn: { x: 0, y: 1 },
    spawnExterior: { id: "test", kind: "test", bounds: { x0: 0, y0: 0, x1: 0, y1: 0 }, ports: [], protectedCells: [] },
    territoryLayouts: [],
    topology: {
      regionCount: 1, connectorCandidateCount: 0, spanningConnectorCount: 0,
      loopConnectorCount: 0, prunedDeadEndCount: 0, retainedDeadEndCount: 0,
      ordinaryCorridorWidthMinimum: DEFAULT_FLOOR_GENERATION_CONFIG.ordinaryCorridorWidthMin,
      ordinaryCorridorWidthMaximum: DEFAULT_FLOOR_GENERATION_CONFIG.ordinaryCorridorWidthMax,
      ordinaryCorridorWidths: [DEFAULT_FLOOR_GENERATION_CONFIG.ordinaryCorridorWidthMin],
      mazeCorridorWidth: DEFAULT_FLOOR_GENERATION_CONFIG.mazeCorridorWidth,
    },
  };
}

export function corridorWidthFixture(): { readonly bounds: FloorBounds; readonly buffers: FloorBuffers; readonly points: ReadonlyMap<number, { readonly x: number; readonly y: number }> } {
  const bounds: FloorBounds = {
    minX: 0, minY: 0, width: 48, height: 24, maxX: 47, maxY: 23,
    minChunkX: 0, minChunkY: 0, maxChunkX: 1, maxChunkY: 0,
  };
  const buffers = createFloorBuffers(bounds);
  const corridors: readonly (readonly [region: number, startX: number])[] = [
    [1, 1], [2, 11], [3, 21], [4, 31],
  ];
  for (const [region, x0] of corridors) {
    for (let y = 4; y < 20; y++) {
      for (let x = x0; x <= x0 + 6; x++) carveAt({ buffers, bounds, point: { x, y }, semantic: FLOOR_SEMANTIC.Corridor, regionId: region });
    }
  }
  return {
    bounds, buffers,
    points: new Map([[1, { x: 4, y: 12 }], [2, { x: 14, y: 12 }], [3, { x: 24, y: 12 }], [4, { x: 34, y: 12 }]]),
  };
}
