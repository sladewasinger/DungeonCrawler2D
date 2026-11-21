/* eslint-disable max-lines -- finite-floor orchestration remains one generation boundary. */
import { hashString, mixSeeds } from "../../core/rng.js";
import { createFloorBuffers, insideBounds, localIndex, materializeBuffers, stampSolid } from "./finiteFloorBuffers.js";
import { assignContiguousTerritories } from "./finiteFloorBiomes.js";
import { sliceFloorChunk } from "./finiteFloorChunk.js";
import { placeSafeRooms, placeSpawnExterior, placeStairways } from "./finiteFloorFeatures.js";
import { placeBossArena, placeMiniBossArenas, restampBossArena, restampMiniBossArena } from "./finiteFloorArenas.js";
import { floorStart, protectRequiredRoutes, profileForBiome } from "./finiteFloorTopology.js";
import { placeRooms } from "./finiteFloorRooms.js";
import { growMaze } from "./finiteFloorMazeGeneration.js";
import { reserveFeatureRegions } from "./finiteFloorFeatureRegions.js";
import { connectDungeonRegions } from "./finiteFloorRegionConnections.js";
import { addMeaningfulLoops } from "./finiteFloorLoops.js";
import { pruneDeadEnds } from "./finiteFloorDeadEnds.js";
import { applyElevationTransitions } from "./finiteFloorElevation.js";
import { validateFloorAttempt } from "./finiteFloorValidation.js";
import { floorDebugExport } from "./finiteFloorDebug.js";
import { floorFingerprint } from "./finiteFloorFingerprint.js";
import { cloneGeneratedFloor } from "./finiteFloorClone.js";
import { floorConfigurationFingerprint, normalizeFloorGenerationConfig } from "./config/floorGenerationConfig.js";
import { territoryProfile } from "./territories/territoryCatalog.js";
import { applyTerritoryLayouts } from "./territories/territoryLayouts.js";
import { connectRequiredTargets, preferredRegionConnectionPoints } from "./connections/finiteRegionBridges.js";
import { openOrdinaryWallGaps } from "./connections/bridges/finiteOrdinaryWallGaps.js";
import { registerRoomEntrances } from "./connections/roomEntrances.js";
import { seedFeatureBackbone } from "./connections/ports/featureRegionPorts.js";
import { carvePathsToReachableCells, disconnectedWalkableCells } from "./connections/validation/finiteFloorRequiredConnectivity.js";
import { analyzeFloorMovement } from "./finiteFloorMovement.js";
import { attemptRouteTargets, mandatoryFeatures } from "./finiteFloorFeatureSet.js";
import { captureFloorGenerationStage, FiniteFloorGenerationTraceBuilder } from "./trace/finiteFloorGenerationTrace.js";
import {
  FLOOR_SEMANTIC,
  type FloorAttempt, type FloorBounds, type FloorBuffers, type FloorGenerationIdentity,
  type FloorGenerationRequest, type FloorGenerationTraceRequest, type FloorPoint, type GeneratedFeatureStamp, type GeneratedFloor, type GeneratedMiniBossArena, type GeneratedRoom,
  type NormalizedFloorGenerationConfig,
} from "./finiteFloorTypes.js";
export {
  DEFAULT_FLOOR_GENERATION_CONFIG, FINITE_GENERATOR_VERSION, FLOOR_SEMANTIC,
} from "./finiteFloorTypes.js";
export type * from "./finiteFloorTypes.js";
export { floorDebugExport }; export { cloneGeneratedFloor };
export { auditProtectedRouteSurfaces } from "./connections/validation/protectedRouteSurfaceAudit.js";
export type { ProtectedRouteSurfaceAudit } from "./connections/validation/protectedRouteSurfaceAudit.js";
export { isProtectedRouteSurfaceWalkable } from "./connections/validation/protectedRouteSurfaceRules.js";
export type { ProtectedRouteSurfacePlanes } from "./connections/validation/protectedRouteSurfaceRules.js";
export {
  GENERATION_SNAPSHOT_METADATA_NAMES,
  GENERATION_SNAPSHOT_PLANE_NAMES,
  generationSnapshotDelta,
} from "./trace/finiteFloorGenerationDelta.js";
export type {
  GenerationSnapshotDelta,
  GenerationSnapshotMetadataDelta,
} from "./trace/finiteFloorGenerationDelta.js";
export {
  DEFAULT_TERRITORY_ROSTER,
  TERRITORY_IDS,
  isTerritoryId,
  territoryProfile,
} from "./territories/territoryCatalog.js";
export {
  FINITE_GENERATION_CONFIG_LIMITS,
  FloorGenerationConfigError,
  floorConfigurationFingerprint,
  normalizeFloorGenerationConfig,
} from "./config/floorGenerationConfig.js";
export type {
  TerritoryId,
  TerritoryLayoutSignature,
  TerritoryProfile,
} from "./territories/territoryCatalog.js";
export type { FloorGenerationSnapshot, FloorGenerationStageId, FloorGenerationTrace } from "./finiteFloorTypes.js";

/** Keeps admin noclip inside tile-center bounds while leaving a half-tile camera margin. */
export const FINITE_NOCLIP_EDGE_MARGIN = 0.5;

export function clampFiniteFloorPosition(
  bounds: Pick<FloorBounds, "minX" | "minY" | "maxX" | "maxY"> | null,
  point: { readonly x: number; readonly y: number },
  edgeMargin = FINITE_NOCLIP_EDGE_MARGIN,
): { readonly x: number; readonly y: number } {
  if (!bounds) return point;
  const minX = bounds.minX + edgeMargin;
  const minY = bounds.minY + edgeMargin;
  const maxX = bounds.maxX + 1 - edgeMargin;
  const maxY = bounds.maxY + 1 - edgeMargin;
  return { x: clamp(point.x, minX, maxX), y: clamp(point.y, minY, maxY) };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const FLOOR_CACHE = new Map<string, GeneratedFloor>();
export interface FiniteFloorRuntimeCacheRequest {
  readonly worldSeed: number;
  readonly floor: number;
  readonly voidTerrain: boolean;
  readonly config: NormalizedFloorGenerationConfig;
}

export interface FiniteFloorRuntimeCache {
  read(request: FiniteFloorRuntimeCacheRequest): GeneratedFloor | null;
  write(request: FiniteFloorRuntimeCacheRequest, floor: GeneratedFloor): void;
}

let testRuntimeCache: FiniteFloorRuntimeCache | null = null;

/** Installs a test-only cache seam; production callers never install one. */
export function installFiniteFloorRuntimeCache(cache: FiniteFloorRuntimeCache | null): () => void {
  const previous = testRuntimeCache;
  testRuntimeCache = cache;
  return () => { testRuntimeCache = previous; };
}

export function clearFiniteFloorCache(): void { FLOOR_CACHE.clear(); }

export function generateFiniteFloor(request: FloorGenerationRequest): GeneratedFloor { return cloneGeneratedFloor(finiteFloorForRuntime(request)); }
export interface GeneratedFloorTrace {
  readonly floor: GeneratedFloor;
  readonly trace: import("./finiteFloorTypes.js").FloorGenerationTrace;
}

export interface FiniteFloorTraceCacheRequest {
  readonly worldSeed: number;
  readonly floor: number;
  readonly voidTerrain: boolean;
  readonly config: NormalizedFloorGenerationConfig;
}

export interface FiniteFloorTraceCache {
  read(request: FiniteFloorTraceCacheRequest): GeneratedFloorTrace | null;
  write(request: FiniteFloorTraceCacheRequest, trace: GeneratedFloorTrace): void;
}

let testTraceCache: FiniteFloorTraceCache | null = null;
const TRACE_CACHE_LIMIT = 8;
const TRACE_CACHE = new Map<string, GeneratedFloorTrace>();

/** Installs a test-only trace cache; production callers never install one. */
export function installFiniteFloorTraceCache(cache: FiniteFloorTraceCache | null): () => void {
  const previous = testTraceCache;
  testTraceCache = cache;
  return () => { testTraceCache = previous; };
}

export function generateFiniteFloorTrace(request: FloorGenerationTraceRequest): GeneratedFloorTrace {
  const config = normalizeFloorGenerationConfig(request.config);
  const key = traceCacheKey(request, config);
  const cached = TRACE_CACHE.get(key);
  if (cached) {
    TRACE_CACHE.delete(key);
    TRACE_CACHE.set(key, cached);
    return cloneTraceResult(cached);
  }
  const generated = generateTrace({ request, config });
  TRACE_CACHE.set(key, generated);
  evictTraceCache();
  return cloneTraceResult(generated);
}

/** Uses the installed test-only cache without changing production trace behavior. */
export function generateFiniteFloorTraceForTests(request: FloorGenerationTraceRequest): GeneratedFloorTrace {
  const config = normalizeFloorGenerationConfig(request.config);
  const cacheRequest = {
    worldSeed: request.worldSeed, floor: request.floor,
    voidTerrain: request.features?.voidTerrain ?? true, config,
  };
  const cached = testTraceCache?.read(cacheRequest);
  if (cached) return cached;
  const trace = generateTrace({ request, config });
  testTraceCache?.write(cacheRequest, trace);
  return trace;
}

function generateTrace(input: { readonly request: FloorGenerationTraceRequest; readonly config: NormalizedFloorGenerationConfig }): GeneratedFloorTrace {
  const { request, config } = input;
  const bounds = makeBounds(config);
  const trace = new FiniteFloorGenerationTraceBuilder(bounds, floorConfigurationFingerprint(config), config);
  const floor = generateWithRetries(
    { request, config, bounds, voidTerrain: request.features?.voidTerrain ?? true, trace },
    { maxRetries: 1, allowOptionalLoopShortfall: true },
  );
  return { floor: cloneGeneratedFloor(floor), trace: trace.build() };
}

function traceCacheKey(
  request: FloorGenerationTraceRequest,
  config: NormalizedFloorGenerationConfig,
): string {
  return [
    request.worldSeed,
    request.floor,
    Number(request.features?.voidTerrain ?? true),
    floorConfigurationFingerprint(config),
  ].join(":");
}

function cloneTraceResult(result: GeneratedFloorTrace): GeneratedFloorTrace {
  return { floor: cloneGeneratedFloor(result.floor), trace: result.trace };
}

function evictTraceCache(): void {
  while (TRACE_CACHE.size > TRACE_CACHE_LIMIT) {
    const oldest = TRACE_CACHE.keys().next().value as string | undefined;
    if (oldest === undefined) return;
    TRACE_CACHE.delete(oldest);
  }
}

export function finiteFloorForRuntime(request: FloorGenerationRequest): GeneratedFloor {
  const config = normalizeFloorGenerationConfig(request.config);
  const features = request.features?.voidTerrain ?? true;
  const cacheKey = `${request.worldSeed}:${request.floor}:${features}:${floorConfigurationFingerprint(config)}`;
  const cached = FLOOR_CACHE.get(cacheKey);
  if (cached) return cached;
  const cacheRequest = { worldSeed: request.worldSeed, floor: request.floor, voidTerrain: features, config };
  const restored = testRuntimeCache?.read(cacheRequest);
  if (restored) {
    FLOOR_CACHE.set(cacheKey, restored);
    return restored;
  }
  const bounds = makeBounds(config);
  const floor = generateWithRetries(
    { request, config, bounds, voidTerrain: features },
    { maxRetries: config.maximumRetries, allowOptionalLoopShortfall: false },
  );
  FLOOR_CACHE.set(cacheKey, floor);
  testRuntimeCache?.write(cacheRequest, floor);
  return floor;
}
function generateWithRetries(
  input: { readonly request: FloorGenerationRequest; readonly config: NormalizedFloorGenerationConfig; readonly bounds: FloorBounds; readonly voidTerrain: boolean; readonly trace?: FiniteFloorGenerationTraceBuilder },
  policy: { readonly maxRetries: number; readonly allowOptionalLoopShortfall: boolean },
): GeneratedFloor {
  const configuration = floorConfigurationFingerprint(input.config);
  let lastFailures: readonly string[] = [];
  for (let retryIndex = 0; retryIndex < policy.maxRetries; retryIndex++) {
    input.trace?.reset();
    const attempt = buildAttempt({ ...input, retryIndex });
    const failures = validateFloorAttempt({
      attempt, bounds: input.bounds, config: input.config,
      allowOptionalLoopShortfall: policy.allowOptionalLoopShortfall,
    });
    if (failures.length === 0) {
      const floor = finalizeFloor({ ...input, attempt, retryIndex, configuration });
      input.trace?.captureFinal(floor);
      return floor;
    }
    lastFailures = failures;
  }
  throw new Error(`Finite floor generation failed for floor ${input.request.floor}: ${lastFailures.join(", ")}`);
}

// eslint-disable-next-line max-lines-per-function
function buildAttempt(input: { readonly request: FloorGenerationRequest; readonly config: NormalizedFloorGenerationConfig; readonly bounds: FloorBounds; readonly voidTerrain: boolean; readonly retryIndex: number; readonly trace?: FiniteFloorGenerationTraceBuilder }): FloorAttempt {
  const seedVersion = layoutSeedVersion(input.config.generatorVersion);
  const seed = mixSeeds(input.request.worldSeed, input.request.floor, seedVersion, input.retryIndex);
  const featureSeed = mixSeeds(input.request.worldSeed, input.request.floor, seedVersion, input.retryIndex);
  const compatibilityStairSeed = mixSeeds(input.request.worldSeed, input.request.floor, seedVersion, 0);
  const buffers = createFloorBuffers(input.bounds);
  assignContiguousTerritories({ buffers, bounds: input.bounds, seed: mixSeeds(seed, hashString("territories")), territoryRoster: input.config.territoryRoster });
  const spawnExterior = makeSpawnExterior({ buffers, bounds: input.bounds, floor: input.request.floor });
  const safeRooms = placeSafeRooms({ buffers, bounds: input.bounds, seed: featureSeed });
  // Legacy descent helpers resolve stair anchors from the retry-0 compatibility
  // seed. Keep only stair placement stable across validation retries; route
  // repair and all other feature placement retain retry-specific variation.
  const stairways = placeStairways({ buffers, bounds: input.bounds, seed: compatibilityStairSeed, floor: input.request.floor });
  const miniBossArenas = placeMiniBossArenas({ buffers, bounds: input.bounds, floor: input.request.floor, seed: featureSeed });
  const bossArena = placeBossArena({ buffers, bounds: input.bounds, floor: input.request.floor, seed: input.request.worldSeed });
  const mandatory = mandatoryFeatures({ floor: input.request.floor, spawnExterior, safeRooms, downStairways: stairways.down, upStairway: stairways.up, miniBossArenas, bossArena });
  const territoryRegionBase = reserveFeatureRegions({ buffers, bounds: input.bounds, features: mandatory });
  const backboneRegionId = territoryRegionBase + input.config.territoryRoster.length;
  const spawn = floorStart({ floor: input.request.floor, bounds: input.bounds, upStair: stairways.up?.position ?? null, spawnExterior: spawnExterior.position ?? null, firstRoom: null });
  const featurePorts = seedFeatureBackbone({ buffers, bounds: input.bounds, features: mandatory, backboneRegionId, spawn, seed: mixSeeds(seed, hashString("feature-backbone")), width: input.config.roomEntranceWidth });
  const territoryLayouts = applyTerritoryLayouts({
    buffers, bounds: input.bounds, config: input.config, rooms: [], firstRegionId: territoryRegionBase,
    backbonePoint: spawn, backboneRegionId, seed: mixSeeds(seed, hashString("territory-layouts")),
  });
  captureFloorGenerationStage(input.trace, { stageId: "mandatory-backbone", bounds: input.bounds, buffers, rooms: [], connectors: [], routes: [], featureStamps: mandatory, territoryLayouts });
  const placedRooms = placeAdmittedRooms({ buffers, bounds: input.bounds, seed: mixSeeds(seed, hashString("rooms")), config: input.config, firstRegionId: backboneRegionId + 1 });
  const rooms = [...placedRooms.rooms];
  captureFloorGenerationStage(input.trace, { stageId: "rooms-envelopes", bounds: input.bounds, buffers, rooms, connectors: [], routes: [], featureStamps: mandatory, territoryLayouts });
  const maze = growMaze({ buffers, bounds: input.bounds, seed: mixSeeds(seed, hashString("mazes")), config: input.config, firstRegionId: nextRegionIdAfterRooms({ backboneRegionId, rooms }) });
  captureFloorGenerationStage(input.trace, { stageId: "maze-fill", bounds: input.bounds, buffers, rooms, connectors: maze.crossings, routes: [], featureStamps: mandatory, territoryLayouts });
  const preferredRegionPoints = preferredRegionConnectionPoints({ buffers, bounds: input.bounds, features: mandatory, rooms });
  const regions = connectDungeonRegions({ buffers, bounds: input.bounds, seed: mixSeeds(seed, hashString("connectors")), corridorWidth: input.config.ordinaryCorridorWidthMin, corridorWidthMax: input.config.ordinaryCorridorWidthMax, connectorDensity: input.config.connectorDensity, preconnectedRegionIds: [...featurePorts.regionLinks, ...placedRooms.regionLinks], preconnectedConnectors: maze.crossings, preferredRegionPoints });
  captureFloorGenerationStage(input.trace, { stageId: "region-connectivity", bounds: input.bounds, buffers, rooms, connectors: regions.spanning, routes: [], featureStamps: mandatory, territoryLayouts });
  const loopResult = addMeaningfulLoops({ buffers, bounds: input.bounds, candidates: regions.remaining, target: input.config.targetLoopCount, minimumPathSaving: input.config.minimumLoopPathSaving, spacing: input.config.connectorSpacing });
  const loops = loopResult.loops;
  const routeTargets = attemptRouteTargets({ features: mandatory, rooms, connectors: [...regions.spanning, ...loops] }); const requiredBridgeWidths = [...connectRequiredTargets({ buffers, bounds: input.bounds, seed: mixSeeds(seed, hashString("required-bridges")), width: input.config.ordinaryCorridorWidthMin, widthMax: input.config.ordinaryCorridorWidthMax, spawn, targets: routeTargets })];
  const routes = protectRequiredRoutes({ buffers, bounds: input.bounds, spawn, targets: routeTargets });
  const deadEnds = pruneDeadEnds({ buffers, bounds: input.bounds, seed: mixSeeds(seed, hashString("dead-ends")), removalFraction: input.config.deadEndRemovalFraction, segments: maze.segments });
  sealMiniBossArenas({ buffers, bounds: input.bounds, arenas: miniBossArenas });
  sealBossArena({ buffers, bounds: input.bounds, arena: bossArena });
  repairRequiredRoutes({ buffers, bounds: input.bounds, seed: mixSeeds(seed, hashString("post-layout-bridges")), width: input.config.ordinaryCorridorWidthMin, widthMax: input.config.ordinaryCorridorWidthMax, spawn, targets: routeTargets, widths: requiredBridgeWidths, routes });
  repairDisconnectedWalkableCells({ buffers, bounds: input.bounds, spawn, miniBossArenas, bossArena, routes, rooms, featureStamps: mandatory });
  openOrdinaryWallGaps({ buffers, bounds: input.bounds, seed: mixSeeds(seed, hashString("ordinary-gaps")), edgeIsLegal: analyzeFloorMovement({ buffers, spawn }, input.bounds).edgeIsLegal });
  applyElevationTransitions({
    buffers, bounds: input.bounds, safeRooms, stairways, miniBossArenas,
    shapeOrdinaryWallMargins: !input.voidTerrain,
    elevationStep: input.config.elevationStep,
    minimumElevation: input.config.minimumElevation,
    maximumElevation: input.config.maximumElevation,
  });
  captureFloorGenerationStage(input.trace, { stageId: "loops-dead-ends-elevation", bounds: input.bounds, buffers, rooms, connectors: [...regions.spanning, ...loops], routes, featureStamps: mandatory, territoryLayouts });
  materializeBuffers({ buffers, bounds: input.bounds, voidTerrain: input.voidTerrain });
  const topology = {
    regionCount: regions.regionCount, connectorCandidateCount: regions.candidateCount,
    spanningConnectorCount: regions.mergeCount, loopConnectorCount: loops.length,
    prunedDeadEndCount: deadEnds.pruned, retainedDeadEndCount: deadEnds.retained,
    ordinaryCorridorWidthMinimum: Math.min(...regions.bridgeWidths, ...requiredBridgeWidths),
    ordinaryCorridorWidthMaximum: Math.max(...regions.bridgeWidths, ...requiredBridgeWidths),
    ordinaryCorridorWidths: [...regions.bridgeWidths, ...requiredBridgeWidths],
    mazeCorridorWidth: input.config.mazeCorridorWidth,
    work: loopResult.work,
  };
  return { buffers, rooms, connectors: [...regions.spanning, ...loops], routes, featureStamps: mandatory, downStairways: stairways.down, upStairway: stairways.up, safeRooms, miniBossArenas, bossArena, spawn, spawnExterior, featurePortFailures: featurePorts.failures, territoryLayouts, topology };
}

function layoutSeedVersion(generatorVersion: number): number {
  const stableLayoutSeedVersion = 5;
  return generatorVersion >= stableLayoutSeedVersion ? stableLayoutSeedVersion : generatorVersion;
}

function repairDisconnectedWalkableCells(input: {
  readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly spawn: FloorPoint;
  readonly miniBossArenas: readonly { readonly bounds: { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number } }[];
  readonly bossArena: { readonly bounds: { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number } } | null;
  readonly routes: FloorPoint[][]; readonly rooms: readonly GeneratedRoom[]; readonly featureStamps: readonly GeneratedFeatureStamp[];
}): void {
  const movement = analyzeFloorMovement({ buffers: input.buffers, spawn: input.spawn }, input.bounds);
  const sealedArenas = [...input.miniBossArenas, ...(input.bossArena ? [input.bossArena] : [])];
  const disconnected = disconnectedWalkableCells({ buffers: input.buffers, bounds: input.bounds, reachable: movement.reachable, sealedArenas });
  const targets = disconnected.filter((point) => requiredRepairTarget({ ...input, point }));
  if (disconnected.length === 0) return;
  connectProtectedTargets({
    buffers: input.buffers, bounds: input.bounds, spawn: input.spawn, targets, routes: input.routes,
    reachable: movement.reachable, movement, sealedArenas, rooms: input.rooms, featureStamps: input.featureStamps,
  });
}

function connectProtectedTargets(input: {
  readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly spawn: FloorPoint;
  readonly targets: readonly FloorPoint[]; readonly routes: (readonly FloorPoint[])[]; readonly reachable: Uint8Array;
  readonly movement: ReturnType<typeof analyzeFloorMovement>;
  readonly sealedArenas: readonly { readonly bounds: { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number } }[];
  readonly rooms: readonly GeneratedRoom[]; readonly featureStamps: readonly GeneratedFeatureStamp[];
}): void {
  if (input.targets.length > 0) replaceRepairedRoutes(input.routes, carvePathsToReachableCells({
    buffers: input.buffers, bounds: input.bounds, targets: input.targets,
    reachable: input.reachable, movement: input.movement,
  }));
  discardUnownedTransitions({ ...input, reachable: analyzeFloorMovement({ buffers: input.buffers, spawn: input.spawn }, input.bounds).reachable });
}

function replaceRepairedRoutes(
  routes: (readonly FloorPoint[])[],
  repairedRoutes: readonly (readonly FloorPoint[])[],
): void {
  const sequenceIndices = new Map(routes.map((route, index) => [routeSequenceKey(route), index]));
  for (const repaired of repairedRoutes) {
    const sequenceKey = routeSequenceKey(repaired);
    const exact = sequenceIndices.get(sequenceKey);
    if (exact !== undefined) {
      routes[exact] = repaired;
      continue;
    }
    const endpoint = repaired.at(-1);
    if (!endpoint) continue;
    const existing = routes.findIndex((route) => routeEndsAt(route, endpoint));
    if (existing >= 0) {
      sequenceIndices.delete(routeSequenceKey(routes[existing] ?? []));
      routes[existing] = repaired;
      sequenceIndices.set(sequenceKey, existing);
      continue;
    }
    routes.push(repaired);
    sequenceIndices.set(sequenceKey, routes.length - 1);
  }
}

function routeEndsAt(route: readonly FloorPoint[], endpoint: FloorPoint): boolean {
  const candidate = route.at(-1);
  return candidate !== undefined && samePoint(candidate, endpoint);
}

function routeSequenceKey(route: readonly FloorPoint[]): string {
  return route.map((point) => `${point.x},${point.y}`).join(";");
}

function discardUnownedTransitions(input: {
  readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly reachable: Uint8Array;
  readonly sealedArenas: readonly { readonly bounds: { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number } }[];
  readonly rooms: readonly GeneratedRoom[]; readonly featureStamps: readonly GeneratedFeatureStamp[];
  readonly routes: readonly (readonly FloorPoint[])[];
}): void {
  const remaining = disconnectedWalkableCells({ ...input });
  for (const point of remaining) {
    if (!isUnownedTransition(input, point)) continue;
    stampSolid({ buffers: input.buffers, bounds: input.bounds, ...point, semantic: FLOOR_SEMANTIC.Solid });
    const index = localIndex({ bounds: input.bounds, ...point });
    input.buffers.protectedCells[index] = 0;
    input.buffers.region[index] = 0;
  }
}

function isUnownedTransition(input: {
  readonly buffers: FloorBuffers; readonly bounds: FloorBounds;
  readonly rooms: readonly GeneratedRoom[]; readonly featureStamps: readonly GeneratedFeatureStamp[];
  readonly routes: readonly (readonly FloorPoint[])[];
}, point: FloorPoint): boolean {
  const index = localIndex({ bounds: input.bounds, ...point });
  return isUnownedTransitionCell(input.buffers, index)
    && !featureOwnsPoint(input.featureStamps, point)
    && !roomOwnsPoint(input.rooms, point)
    && !routeOwnsPoint(input.routes, point);
}

function isUnownedTransitionCell(buffers: FloorBuffers, index: number): boolean {
  return buffers.semantic[index] === FLOOR_SEMANTIC.Transition
    && buffers.features[index] === 0
    && buffers.protectedCells[index] !== 1
    && (buffers.roomIds[index] ?? -1) < 0
    && (buffers.roomWallIds[index] ?? -1) < 0;
}

function featureOwnsPoint(features: readonly GeneratedFeatureStamp[], point: FloorPoint): boolean {
  return features.some((feature) => feature.ports.some((port) => samePoint(port, point))
    || feature.protectedCells.some((protectedPoint) => samePoint(protectedPoint, point)));
}

function roomOwnsPoint(rooms: readonly GeneratedRoom[], point: FloorPoint): boolean {
  return rooms.some((room) => samePoint(room.center, point)
    || room.entrances.some((entrance) => samePoint(entrance.position, point)));
}

function routeOwnsPoint(routes: readonly (readonly FloorPoint[])[], point: FloorPoint): boolean {
  return routes.some((route) => route.some((routePoint) => samePoint(routePoint, point)));
}

function samePoint(left: FloorPoint, right: FloorPoint): boolean { return left.x === right.x && left.y === right.y; }

function requiredRepairTarget(input: {
  readonly buffers: FloorBuffers;
  readonly bounds: FloorBounds;
  readonly rooms: readonly GeneratedRoom[];
  readonly featureStamps: readonly GeneratedFeatureStamp[];
  readonly routes: readonly (readonly FloorPoint[])[];
  readonly point: FloorPoint;
}): boolean {
  const index = localIndex({ bounds: input.bounds, ...input.point });
  return input.buffers.protectedCells[index] === 1
    || featureOwnsPoint(input.featureStamps, input.point)
    || roomOwnsPoint(input.rooms, input.point)
    || routeOwnsPoint(input.routes, input.point);
}

function nextRegionIdAfterRooms(input: { readonly backboneRegionId: number; readonly rooms: readonly GeneratedRoom[] }): number {
  return input.rooms.reduce(
    (next, room) => Math.max(next, room.regionId + 1),
    input.backboneRegionId + 1,
  );
}

function placeAdmittedRooms(input: {
  readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly seed: number;
  readonly config: NormalizedFloorGenerationConfig; readonly firstRegionId: number;
}): { readonly rooms: readonly GeneratedRoom[]; readonly regionLinks: readonly (readonly [number, number])[] } {
  let placement = placeRooms(input);
  let admission = admitRooms(input, placement.rooms);
  while (admission.rooms.length < input.config.roomTargetCount && placement.attemptsUsed < input.config.roomAttemptBudget) {
    const refill = placeRooms({
      ...input,
      targetCount: input.config.roomTargetCount - admission.rooms.length,
      attemptStart: placement.attemptsUsed,
      attemptBudget: input.config.roomAttemptBudget - placement.attemptsUsed,
      roomIdStart: placement.nextRoomId,
    });
    if (refill.attemptsUsed === 0) break;
    const refillAdmission = admitRooms(input, refill.rooms);
    admission = {
      rooms: [...admission.rooms, ...refillAdmission.rooms],
      regionLinks: [...admission.regionLinks, ...refillAdmission.regionLinks],
    };
    placement = {
      rooms: [...placement.rooms, ...refill.rooms],
      attemptsUsed: placement.attemptsUsed + refill.attemptsUsed,
      nextRoomId: refill.nextRoomId,
    };
  }
  return admission;
}

function admitRooms(input: {
  readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly seed: number;
  readonly config: NormalizedFloorGenerationConfig;
}, rooms: readonly GeneratedRoom[]): { readonly rooms: readonly GeneratedRoom[]; readonly regionLinks: readonly (readonly [number, number])[] } {
  const result = registerRoomEntrances({ buffers: input.buffers, bounds: input.bounds, rooms, seed: input.seed, width: input.config.roomEntranceWidth });
  return { rooms: result.rooms, regionLinks: result.regionLinks };
}

function repairRequiredRoutes(input: {
  readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly seed: number;
  readonly width: number; readonly widthMax: number; readonly spawn: FloorPoint;
  readonly targets: readonly FloorPoint[]; readonly widths: number[]; readonly routes: FloorPoint[][];
}): void {
  input.widths.push(...connectRequiredTargets({ ...input, width: input.width, widthMax: input.widthMax }));
  input.routes.splice(0, input.routes.length, ...protectRequiredRoutes(input));
}


function sealBossArena(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly arena: ReturnType<typeof placeBossArena> }): void {
  if (input.arena) restampBossArena({ buffers: input.buffers, bounds: input.bounds, arena: input.arena });
}

function sealMiniBossArenas(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly arenas: readonly GeneratedMiniBossArena[] }): void {
  for (const arena of input.arenas) restampMiniBossArena({ buffers: input.buffers, bounds: input.bounds, arena });
}

function makeSpawnExterior(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly floor: number }): GeneratedFeatureStamp {
  if (input.floor === 1) return placeSpawnExterior(input);
  const position = centerOf(input.bounds);
  const bounds = { x0: position.x - 3, y0: position.y - 3, x1: position.x + 3, y1: position.y + 3 };
  for (let y = bounds.y0; y <= bounds.y1; y++) for (let x = bounds.x0; x <= bounds.x1; x++) {
    if (insideBounds({ bounds: input.bounds, x, y })) input.buffers.protectedCells[localIndex({ bounds: input.bounds, x, y })] = 1;
  }
  return { id: "spawn", kind: "spawn", bounds, ports: [position], protectedCells: [position], position };
}

function finalizeFloor(input: { readonly request: FloorGenerationRequest; readonly config: NormalizedFloorGenerationConfig; readonly bounds: FloorBounds; readonly voidTerrain: boolean; readonly attempt: FloorAttempt; readonly retryIndex: number; readonly configuration: string }): GeneratedFloor {
  const featureIds = input.attempt.buffers.featureIds;
  input.attempt.featureStamps.forEach((feature, id) => stampFeatureId({ ids: featureIds, bounds: input.bounds, feature, id }));
  const fingerprint = floorFingerprint(input.attempt, input.bounds);
  const identity: FloorGenerationIdentity = { seed: mixSeeds(input.request.worldSeed, input.request.floor, input.config.generatorVersion), generatorVersion: input.config.generatorVersion, retryIndex: input.retryIndex, configurationFingerprint: input.configuration, fingerprint, bounds: input.bounds };
  const territories = input.config.territoryRoster.map(territoryProfile);
  return { worldSeed: input.request.worldSeed, floor: input.request.floor, voidTerrain: input.voidTerrain, configuration: input.config, identity, bounds: input.bounds, ...input.attempt.buffers, territories, territoryLayouts: input.attempt.territoryLayouts, rooms: input.attempt.rooms, connectors: input.attempt.connectors, routes: input.attempt.routes, featureStamps: input.attempt.featureStamps, downStairways: input.attempt.downStairways, upStairway: input.attempt.upStairway, safeRooms: input.attempt.safeRooms, miniBossArenas: input.attempt.miniBossArenas, bossArena: input.attempt.bossArena, spawn: input.attempt.spawn, spawnExterior: input.attempt.spawnExterior, topology: input.attempt.topology };
}

function stampFeatureId(input: { readonly ids: Int16Array; readonly bounds: FloorBounds; readonly feature: GeneratedFeatureStamp; readonly id: number }): void {
  for (let y = input.feature.bounds.y0; y <= input.feature.bounds.y1; y++) for (let x = input.feature.bounds.x0; x <= input.feature.bounds.x1; x++) {
    if (insideBounds({ bounds: input.bounds, x, y })) input.ids[localIndex({ bounds: input.bounds, x, y })] = input.id;
  }
}
function makeBounds(config: NormalizedFloorGenerationConfig): FloorBounds {
  const maxX = config.minX + config.width - 1;
  const maxY = config.minY + config.height - 1;
  return { minX: config.minX, minY: config.minY, width: config.width, height: config.height, maxX, maxY, minChunkX: Math.floor(config.minX / 32), minChunkY: Math.floor(config.minY / 32), maxChunkX: Math.floor(maxX / 32), maxChunkY: Math.floor(maxY / 32) };
}

function centerOf(bounds: FloorBounds): FloorPoint { return { x: Math.floor((bounds.minX + bounds.maxX) / 2), y: Math.floor((bounds.minY + bounds.maxY) / 2) }; }

export function sliceGeneratedFloorChunk(floor: GeneratedFloor, cx: number, cy: number) { return sliceFloorChunk(floor, cx, cy); }
export function floorBiomeAt(floor: GeneratedFloor, x: number, y: number) {
  const tileX = Math.floor(x);
  const tileY = Math.floor(y);
  if (!insideBounds({ bounds: floor.bounds, x: tileX, y: tileY })) return null;
  const biome = floor.biome[localIndex({ bounds: floor.bounds, x: tileX, y: tileY })] ?? 0;
  return profileForBiome(biome);
}
export function floorTerritoryAt(floor: GeneratedFloor, x: number, y: number): number | null {
  const tileX = Math.floor(x);
  const tileY = Math.floor(y);
  if (!insideBounds({ bounds: floor.bounds, x: tileX, y: tileY })) return null;
  return floor.territory[localIndex({ bounds: floor.bounds, x: tileX, y: tileY })] ?? null;
}
export function floorFeatureAt(floor: GeneratedFloor, x: number, y: number): GeneratedFeatureStamp | null {
  const tileX = Math.floor(x);
  const tileY = Math.floor(y);
  if (!insideBounds({ bounds: floor.bounds, x: tileX, y: tileY })) return null;
  const id = floor.featureIds[localIndex({ bounds: floor.bounds, x: tileX, y: tileY })] ?? -1;
  return id >= 0 ? floor.featureStamps[id] ?? null : null;
}
