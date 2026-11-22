import { mixSeeds } from "../../../core/rng.js";
import { restampBossArena, restampMiniBossArena, placeBossArena, placeMiniBossArenas } from "../finiteFloorArenas.js";
import { createFloorBuffers, insideBounds, localIndex, materializeBuffers } from "../finiteFloorBuffers.js";
import { applyFeatureElevationRamps } from "../finiteFloorElevation.js";
import { mandatoryFeatures } from "../finiteFloorFeatureSet.js";
import { placeSafeRooms, placeSpawnExterior, placeStairways } from "../finiteFloorFeatures.js";
import { floorStart } from "../finiteFloorTopology.js";
import type {
  FloorAttempt,
  FloorBounds,
  FloorGenerationRequest,
  FloorPoint,
  FloorRect,
  FloorTopologySummary,
  GeneratedFeatureStamp,
  GeneratedTerritoryLayout,
  NormalizedFloorGenerationConfig,
} from "../finiteFloorTypes.js";
import { territoryProfile, type TerritoryId } from "../territories/territoryCatalog.js";
import { captureFloorGenerationStage, type FiniteFloorGenerationTraceBuilder } from "../trace/finiteFloorGenerationTrace.js";
import { ensureForestConnectivity } from "./forestConnectivity.js";
import { placeForestLandmarks } from "./landmarks/forestLandmarks.js";
import { placeForestProps } from "./forestProps.js";
import { placeForestRivers } from "./forestRivers.js";
import { placeOpenWorldGlades } from "./openWorldGlades.js";
import { generateOpenWorldTerrain, smoothOpenWorldHills } from "./openWorldTerrain.js";

export interface OpenWorldAttemptInput {
  readonly request: FloorGenerationRequest;
  readonly config: NormalizedFloorGenerationConfig;
  readonly bounds: FloorBounds;
  readonly voidTerrain: boolean;
  readonly retryIndex: number;
  readonly trace?: FiniteFloorGenerationTraceBuilder;
}

export function buildOpenWorldAttempt(input: OpenWorldAttemptInput): FloorAttempt {
  const { request, config, bounds } = input;
  const seed = mixSeeds(request.worldSeed, request.floor, config.generatorVersion, input.retryIndex);
  const featureSeed = mixSeeds(request.worldSeed, request.floor, 5, 0);
  const buffers = createFloorBuffers(bounds);
  const spawnExterior = makeSpawnExterior(buffers, bounds, request.floor);
  const safeRooms = placeSafeRooms({ buffers, bounds, seed });
  const stairways = placeStairways({ buffers, bounds, seed: featureSeed, floor: request.floor });
  const miniBossArenas = placeMiniBossArenas({ buffers, bounds, floor: request.floor, seed });
  const bossArena = placeBossArena({ buffers, bounds, floor: request.floor, seed: request.worldSeed });
  const featureStamps = mandatoryFeatures({ floor: request.floor, spawnExterior, safeRooms, downStairways: stairways.down, upStairway: stairways.up, miniBossArenas, bossArena });
  const spawn = floorStart({ floor: request.floor, bounds, upStair: stairways.up?.position ?? null, spawnExterior: spawnExterior.position ?? null, firstRoom: null });
  const sealedArenas: FloorRect[] = [...miniBossArenas.map((arena) => arena.bounds), ...(bossArena ? [bossArena.bounds] : [])];
  const territoryLayouts = buildTerritoryLayouts(config.territoryRoster);
  captureStage({ trace: input.trace, stageId: "mandatory-backbone", bounds, buffers, rooms: [], featureStamps, territoryLayouts });
  generateOpenWorldTerrain({ buffers, bounds, seed, spawn, featureStamps, sealedArenas });
  for (const arena of miniBossArenas) restampMiniBossArena({ buffers, bounds, arena });
  if (bossArena) restampBossArena({ buffers, bounds, arena: bossArena });
  applyFeatureElevationRamps({ buffers, bounds, safeRooms, stairways, miniBossArenas, elevationStep: config.elevationStep, minimumElevation: config.minimumElevation, maximumElevation: config.maximumElevation });
  const rooms = placeOpenWorldGlades({ buffers, bounds, seed, spawn });
  captureStage({ trace: input.trace, stageId: "rooms-envelopes", bounds, buffers, rooms, featureStamps, territoryLayouts });
  populateOpenWorldSurface({ trace: input.trace, bounds, buffers, rooms, featureStamps, territoryLayouts, seed, spawn, sealedArenas });
  ensureForestConnectivity({ buffers, bounds, spawn, sealedArenas });
  captureStage({ trace: input.trace, stageId: "loops-dead-ends-elevation", bounds, buffers, rooms, featureStamps, territoryLayouts });
  materializeBuffers({ buffers, bounds, voidTerrain: input.voidTerrain });
  return {
    buffers, rooms, connectors: [], routes: [], featureStamps,
    downStairways: stairways.down, upStairway: stairways.up, safeRooms, miniBossArenas, bossArena,
    spawn, spawnExterior, territoryLayouts, topology: buildTopologySummary(config),
  };
}

interface SurfacePopulateInput {
  readonly trace: FiniteFloorGenerationTraceBuilder | undefined;
  readonly bounds: FloorBounds;
  readonly buffers: FloorAttempt["buffers"];
  readonly rooms: FloorAttempt["rooms"];
  readonly featureStamps: readonly GeneratedFeatureStamp[];
  readonly territoryLayouts: readonly GeneratedTerritoryLayout[];
  readonly seed: number;
  readonly spawn: FloorPoint;
  readonly sealedArenas: readonly FloorRect[];
}

function populateOpenWorldSurface(input: SurfacePopulateInput): void {
  const { trace, bounds, buffers, rooms, featureStamps, territoryLayouts, seed, spawn, sealedArenas } = input;
  const layout = { buffers, bounds, seed, spawn, featureStamps, sealedArenas };
  placeForestRivers(layout);
  captureStage({ trace, stageId: "maze-fill", bounds, buffers, rooms, featureStamps, territoryLayouts });
  smoothOpenWorldHills(layout);
  placeForestLandmarks(layout);
  placeForestProps(layout);
  captureStage({ trace, stageId: "region-connectivity", bounds, buffers, rooms, featureStamps, territoryLayouts });
}

function captureStage(input: {
  readonly trace: FiniteFloorGenerationTraceBuilder | undefined;
  readonly stageId: "mandatory-backbone" | "rooms-envelopes" | "maze-fill" | "region-connectivity" | "loops-dead-ends-elevation";
  readonly bounds: FloorBounds;
  readonly buffers: FloorAttempt["buffers"];
  readonly rooms: FloorAttempt["rooms"];
  readonly featureStamps: readonly GeneratedFeatureStamp[];
  readonly territoryLayouts: readonly GeneratedTerritoryLayout[];
}): void {
  captureFloorGenerationStage(input.trace, {
    stageId: input.stageId, bounds: input.bounds, buffers: input.buffers,
    rooms: input.rooms, connectors: [], routes: [],
    featureStamps: input.featureStamps, territoryLayouts: input.territoryLayouts,
  });
}

function makeSpawnExterior(
  buffers: FloorAttempt["buffers"],
  bounds: FloorBounds,
  floor: number,
): GeneratedFeatureStamp {
  if (floor === 1) return placeSpawnExterior({ buffers, bounds });
  const position: FloorPoint = {
    x: Math.floor((bounds.minX + bounds.maxX) / 2),
    y: Math.floor((bounds.minY + bounds.maxY) / 2),
  };
  const rect = { x0: position.x - 3, y0: position.y - 3, x1: position.x + 3, y1: position.y + 3 };
  protectSpawnPad(buffers, bounds, rect);
  return { id: "spawn", kind: "spawn", bounds: rect, ports: [position], protectedCells: [position], position };
}

function protectSpawnPad(buffers: FloorAttempt["buffers"], bounds: FloorBounds, rect: FloorRect): void {
  for (let y = rect.y0; y <= rect.y1; y++) {
    for (let x = rect.x0; x <= rect.x1; x++) {
      if (insideBounds({ bounds, x, y })) buffers.protectedCells[localIndex({ bounds, x, y })] = 1;
    }
  }
}

function buildTerritoryLayouts(roster: readonly TerritoryId[]): GeneratedTerritoryLayout[] {
  return roster.map((id) => {
    const profile = territoryProfile(id);
    return {
      territoryId: profile.id, catalogId: profile.id, label: profile.name,
      visualIdentity: profile.visualIdentity, ownershipTags: profile.ownershipTags,
      layoutSignature: profile.layoutSignature, openedCells: 1, obstacleCells: 0,
      branchPockets: 0, elevatedCells: 0, geometryMetrics: { structuralCells: 1 },
    };
  });
}

function buildTopologySummary(config: NormalizedFloorGenerationConfig): FloorTopologySummary {
  return {
    regionCount: 1, connectorCandidateCount: 0, spanningConnectorCount: 0,
    loopConnectorCount: 0, prunedDeadEndCount: 0, retainedDeadEndCount: 0,
    ordinaryCorridorWidthMinimum: config.ordinaryCorridorWidthMin,
    ordinaryCorridorWidthMaximum: config.ordinaryCorridorWidthMax,
    ordinaryCorridorWidths: [config.ordinaryCorridorWidthMin],
    mazeCorridorWidth: config.mazeCorridorWidth,
  };
}
