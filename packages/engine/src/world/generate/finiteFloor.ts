/* eslint-disable max-lines -- finite-floor public API and caches stay in one facade. */
import { mixSeeds } from "../../core/rng.js";
import { insideBounds, localIndex } from "./finiteFloorBuffers.js";
import { sliceFloorChunk } from "./finiteFloorChunk.js";
import { profileForBiome } from "./finiteFloorTopology.js";
import { validateFloorAttempt } from "./finiteFloorValidation.js";
import { floorDebugExport } from "./finiteFloorDebug.js";
import { floorFingerprint } from "./finiteFloorFingerprint.js";
import { cloneGeneratedFloor } from "./finiteFloorClone.js";
import { floorConfigurationFingerprint, normalizeFloorGenerationConfig } from "./config/floorGenerationConfig.js";
import { territoryProfile } from "./territories/territoryCatalog.js";
import { FiniteFloorGenerationTraceBuilder } from "./trace/finiteFloorGenerationTrace.js";
import { buildOpenWorldAttempt } from "./forest/openWorldFloor.js";
import {
  type FloorAttempt, type FloorBounds, type FloorGenerationIdentity,
  type FloorGenerationRequest, type FloorGenerationTraceRequest, type GeneratedFeatureStamp, type GeneratedFloor,
  type NormalizedFloorGenerationConfig,
} from "./finiteFloorTypes.js";

export { DEFAULT_FLOOR_GENERATION_CONFIG, FINITE_GENERATOR_VERSION, FLOOR_SEMANTIC } from "./finiteFloorTypes.js";
export type * from "./finiteFloorTypes.js";
export { floorDebugExport, cloneGeneratedFloor };
export { auditProtectedRouteSurfaces } from "./connections/validation/protectedRouteSurfaceAudit.js";
export type { ProtectedRouteSurfaceAudit } from "./connections/validation/protectedRouteSurfaceAudit.js";
export { isProtectedRouteSurfaceWalkable } from "./connections/validation/protectedRouteSurfaceRules.js";
export type { ProtectedRouteSurfacePlanes } from "./connections/validation/protectedRouteSurfaceRules.js";
export { GENERATION_SNAPSHOT_METADATA_NAMES, GENERATION_SNAPSHOT_PLANE_NAMES, generationSnapshotDelta } from "./trace/finiteFloorGenerationDelta.js";
export type { GenerationSnapshotDelta, GenerationSnapshotMetadataDelta } from "./trace/finiteFloorGenerationDelta.js";
export { DEFAULT_TERRITORY_ROSTER, TERRITORY_IDS, isTerritoryId, territoryProfile } from "./territories/territoryCatalog.js";
export { FINITE_GENERATION_CONFIG_LIMITS, FloorGenerationConfigError, floorConfigurationFingerprint, normalizeFloorGenerationConfig } from "./config/floorGenerationConfig.js";
export type { TerritoryId, TerritoryLayoutSignature, TerritoryProfile } from "./territories/territoryCatalog.js";
export type { FloorGenerationSnapshot, FloorGenerationStageId, FloorGenerationTrace } from "./finiteFloorTypes.js";

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
  return { x: Math.min(maxX, Math.max(minX, point.x)), y: Math.min(maxY, Math.max(minY, point.y)) };
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
export function installFiniteFloorRuntimeCache(cache: FiniteFloorRuntimeCache | null): () => void {
  const previous = testRuntimeCache;
  testRuntimeCache = cache;
  return () => { testRuntimeCache = previous; };
}
export function clearFiniteFloorCache(): void { FLOOR_CACHE.clear(); }
export function generateFiniteFloor(request: FloorGenerationRequest): GeneratedFloor { return cloneGeneratedFloor(finiteFloorForRuntime(request)); }
export interface GeneratedFloorTrace { readonly floor: GeneratedFloor; readonly trace: import("./finiteFloorTypes.js").FloorGenerationTrace; }
export interface FiniteFloorTraceCacheRequest { readonly worldSeed: number; readonly floor: number; readonly voidTerrain: boolean; readonly config: NormalizedFloorGenerationConfig; }
export interface FiniteFloorTraceCache { read(request: FiniteFloorTraceCacheRequest): GeneratedFloorTrace | null; write(request: FiniteFloorTraceCacheRequest, trace: GeneratedFloorTrace): void; }
let testTraceCache: FiniteFloorTraceCache | null = null;
const TRACE_CACHE_LIMIT = 8;
const TRACE_CACHE = new Map<string, GeneratedFloorTrace>();
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
  while (TRACE_CACHE.size > TRACE_CACHE_LIMIT) {
    const oldest = TRACE_CACHE.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    TRACE_CACHE.delete(oldest);
  }
  return cloneTraceResult(generated);
}

export function generateFiniteFloorTraceForTests(request: FloorGenerationTraceRequest): GeneratedFloorTrace {
  const config = normalizeFloorGenerationConfig(request.config);
  const cacheRequest = { worldSeed: request.worldSeed, floor: request.floor, voidTerrain: request.features?.voidTerrain ?? true, config };
  const cached = testTraceCache?.read(cacheRequest);
  if (cached) return cached;
  const trace = generateTrace({ request, config });
  testTraceCache?.write(cacheRequest, trace);
  return trace;
}

function generateTrace(input: { readonly request: FloorGenerationTraceRequest; readonly config: NormalizedFloorGenerationConfig }): GeneratedFloorTrace {
  const bounds = makeBounds(input.config);
  const trace = new FiniteFloorGenerationTraceBuilder(bounds, floorConfigurationFingerprint(input.config), input.config);
  const floor = generateWithRetries({ request: input.request, config: input.config, bounds, voidTerrain: input.request.features?.voidTerrain ?? true, trace }, input.config.maximumRetries);
  return { floor: cloneGeneratedFloor(floor), trace: trace.build() };
}

function traceCacheKey(request: FloorGenerationTraceRequest, config: NormalizedFloorGenerationConfig): string {
  return [request.worldSeed, request.floor, Number(request.features?.voidTerrain ?? true), floorConfigurationFingerprint(config)].join(":");
}
function cloneTraceResult(result: GeneratedFloorTrace): GeneratedFloorTrace { return { floor: cloneGeneratedFloor(result.floor), trace: result.trace }; }

export function finiteFloorForRuntime(request: FloorGenerationRequest): GeneratedFloor {
  const config = normalizeFloorGenerationConfig(request.config);
  const features = request.features?.voidTerrain ?? true;
  const cacheKey = `${request.worldSeed}:${request.floor}:${features}:${floorConfigurationFingerprint(config)}`;
  const cached = FLOOR_CACHE.get(cacheKey);
  if (cached) return cached;
  const cacheRequest = { worldSeed: request.worldSeed, floor: request.floor, voidTerrain: features, config };
  const restored = testRuntimeCache?.read(cacheRequest);
  if (restored) { FLOOR_CACHE.set(cacheKey, restored); return restored; }
  const floor = generateWithRetries({ request, config, bounds: makeBounds(config), voidTerrain: features }, config.maximumRetries);
  FLOOR_CACHE.set(cacheKey, floor);
  testRuntimeCache?.write(cacheRequest, floor);
  return floor;
}

function generateWithRetries(
  input: { readonly request: FloorGenerationRequest; readonly config: NormalizedFloorGenerationConfig; readonly bounds: FloorBounds; readonly voidTerrain: boolean; readonly trace?: FiniteFloorGenerationTraceBuilder },
  maxRetries: number,
): GeneratedFloor {
  const configuration = floorConfigurationFingerprint(input.config);
  let lastFailures: readonly string[] = [];
  for (let retryIndex = 0; retryIndex < maxRetries; retryIndex++) {
    input.trace?.reset();
    const attempt = buildOpenWorldAttempt({ ...input, retryIndex });
    const failures = validateFloorAttempt({ attempt, bounds: input.bounds, config: input.config });
    if (failures.length === 0) {
      const floor = finalizeFloor({ ...input, attempt, retryIndex, configuration });
      input.trace?.captureFinal(floor);
      return floor;
    }
    lastFailures = failures;
  }
  throw new Error(`Finite floor generation failed for floor ${input.request.floor}: ${lastFailures.join(", ")}`);
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
  for (let y = input.feature.bounds.y0; y <= input.feature.bounds.y1; y++) {
    for (let x = input.feature.bounds.x0; x <= input.feature.bounds.x1; x++) {
      if (insideBounds({ bounds: input.bounds, x, y })) input.ids[localIndex({ bounds: input.bounds, x, y })] = input.id;
    }
  }
}

function makeBounds(config: NormalizedFloorGenerationConfig): FloorBounds {
  const maxX = config.minX + config.width - 1;
  const maxY = config.minY + config.height - 1;
  return { minX: config.minX, minY: config.minY, width: config.width, height: config.height, maxX, maxY, minChunkX: Math.floor(config.minX / 32), minChunkY: Math.floor(config.minY / 32), maxChunkX: Math.floor(maxX / 32), maxChunkY: Math.floor(maxY / 32) };
}

export function sliceGeneratedFloorChunk(floor: GeneratedFloor, cx: number, cy: number) { return sliceFloorChunk(floor, cx, cy); }
export function floorBiomeAt(floor: GeneratedFloor, x: number, y: number) {
  const tileX = Math.floor(x);
  const tileY = Math.floor(y);
  if (!insideBounds({ bounds: floor.bounds, x: tileX, y: tileY })) return null;
  return profileForBiome(floor.biome[localIndex({ bounds: floor.bounds, x: tileX, y: tileY })] ?? 0);
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
