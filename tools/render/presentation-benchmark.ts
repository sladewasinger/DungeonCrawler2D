import {
  LEVEL,
  World,
  type WorldFeatures,
} from "../../packages/engine/src/index.js";
import {
  buildToonVisibilityField,
} from "../../packages/client/src/render/lighting/toon/toonVisibilityField.js";
import {
  TOON_LIGHTING_BUDGET,
} from "../../packages/client/src/render/lighting/toon/performance/toonLightingBudget.js";
import {
  appendVisibleChunkPlans,
  emptyTerrainBatches,
  TerrainChunkPlanCache,
} from "../../packages/client/src/render/terrain/planning/chunkCache.js";
import { createTerrainSource } from "../../packages/client/src/render/terrain/runtime/source.js";
import { renderDeviceProfileReport } from "./device-profile-report.js";

const WORLD_SEED = 228_182_761;
const VIEW = Object.freeze({ x: -32, y: -18, width: 64, height: 36 });
const FEATURES: WorldFeatures = Object.freeze({ voidTerrain: false });

interface BenchmarkMeasurement {
  readonly medianMs: number;
  readonly minimumMs: number;
  readonly maximumMs: number;
}

interface TileCoordinate {
  readonly x: number;
  readonly y: number;
}

const world = new World(WORLD_SEED, 1, {
  level: LEVEL.Dungeon,
  features: FEATURES,
});
const player = nearestWalkableTileCenter(world, 0, 0);
const field = buildToonVisibilityField({
  world,
  player,
  bounds: VIEW,
  orientation: 0,
});
const classic = terrainSelection(world, null);
const toon = terrainSelection(world, {
  revision: 1,
  isWorldPositionVisible: (x, y) =>
    field.visibleTiles.has(`${Math.floor(x)},${Math.floor(y)}`),
});

const report = {
  command: "npm run benchmark:render",
  worldSeed: WORLD_SEED,
  view: VIEW,
  player,
  classic: {
    terrainCandidateQuads: classic.candidateQuads,
    terrainSubmittedQuads: classic.submittedQuads,
    maximumGroundLightObjects:
      TOON_LIGHTING_BUDGET.classicMaximumPlayerGroundLightObjects,
  },
  toon: {
    visibleTiles: field.visibleTiles.size,
    terrainCandidateQuads: toon.candidateQuads,
    terrainSubmittedQuads: toon.submittedQuads,
    terrainSubmissionReduction: reduction(
      classic.submittedQuads,
      toon.submittedQuads,
    ),
    maskObjects: TOON_LIGHTING_BUDGET.maskGameObjects,
    groundLightObjects: TOON_LIGHTING_BUDGET.playerGroundLightObjects,
    evaluatedCells: field.evaluatedCells,
    lineOfSightChecks: field.lineOfSightChecks,
    occluderChecks: field.occluderChecks,
  },
  visibilityBuild: measure(() => {
    buildToonVisibilityField({
      world,
      player,
      bounds: VIEW,
      orientation: 0,
    });
  }),
  deviceProfiles: renderDeviceProfileReport(),
};

console.log(JSON.stringify(report, null, 2));

function terrainSelection(
  benchmarkWorld: World,
  visibility: Parameters<typeof appendVisibleChunkPlans>[0]["visibility"],
) {
  return appendVisibleChunkPlans({
    target: emptyTerrainBatches(),
    cache: new TerrainChunkPlanCache(),
    source: createTerrainSource(benchmarkWorld),
    bounds: VIEW,
    orientation: 0,
    revision: benchmarkWorld.tileRevision,
    visibility,
  });
}

function nearestWalkableTileCenter(
  benchmarkWorld: World,
  originX: number,
  originY: number,
): Readonly<TileCoordinate> {
  const origin = { x: originX, y: originY };
  for (let radius = 0; radius <= 32; radius += 1) {
    const tile = walkableTileOnRing(benchmarkWorld, origin, radius);
    if (tile) return { x: tile.x + 0.5, y: tile.y + 0.5 };
  }
  throw new Error("Render benchmark could not find a walkable origin");
}

function walkableTileOnRing(
  benchmarkWorld: World,
  origin: TileCoordinate,
  radius: number,
): Readonly<TileCoordinate> | null {
  for (let y = origin.y - radius; y <= origin.y + radius; y += 1) {
    const tile = walkableTileInRingRow(benchmarkWorld, { origin, radius, y });
    if (tile) return tile;
  }
  return null;
}

function walkableTileInRingRow(
  benchmarkWorld: World,
  row: Readonly<{ origin: TileCoordinate; radius: number; y: number }>,
): Readonly<TileCoordinate> | null {
  const { origin, radius, y } = row;
  for (let x = origin.x - radius; x <= origin.x + radius; x += 1) {
    const ringDistance = Math.max(Math.abs(x - origin.x), Math.abs(y - origin.y));
    if (ringDistance === radius && benchmarkWorld.isWalkable(x, y)) return { x, y };
  }
  return null;
}

function measure(action: () => void): BenchmarkMeasurement {
  const samples: number[] = [];
  for (let index = 0; index < 25; index += 1) {
    const start = performance.now();
    action();
    samples.push(performance.now() - start);
  }
  samples.sort((left, right) => left - right);
  return {
    medianMs: samples[Math.floor(samples.length / 2)] ?? 0,
    minimumMs: samples[0] ?? 0,
    maximumMs: samples.at(-1) ?? 0,
  };
}

function reduction(before: number, after: number): number {
  if (before <= 0) return 0;
  return 1 - after / before;
}
