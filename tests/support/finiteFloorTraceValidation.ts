import { hashString, mixSeeds } from "../../packages/engine/src/core/rng.js";
import {
  type FiniteFloorTraceCacheRequest,
  type GeneratedFloorTrace,
} from "../../packages/engine/src/world/generate/finiteFloor.js";
import { floorConfigurationFingerprint } from "../../packages/engine/src/world/generate/config/floorGenerationConfig.js";
import { generatedFloorFingerprint } from "../../packages/engine/src/world/generate/finiteFloorFingerprint.js";
import { validateTraceSnapshots } from "./finiteFloorTraceSnapshotValidation.js";

export function assertTraceIdentity(
  trace: GeneratedFloorTrace,
  request: FiniteFloorTraceCacheRequest,
  expectedContentFingerprint = traceContentFingerprint(trace.trace),
): void {
  if (!matchesTrace(trace, request, expectedContentFingerprint)) throw new Error("Trace fixture identity mismatch");
}

export function traceContentFingerprint(trace: GeneratedFloorTrace["trace"]): string {
  return hashString(JSON.stringify({
    bounds: trace.bounds,
    configurationFingerprint: trace.configurationFingerprint,
    effectiveConfiguration: trace.effectiveConfiguration,
    snapshots: trace.snapshots.map(snapshotContent),
  })).toString(16);
}

export function matchesIdentity(trace: GeneratedFloorTrace, request: FiniteFloorTraceCacheRequest): boolean {
  const fingerprint = floorConfigurationFingerprint(request.config);
  const floor = trace.floor;
  const effective = trace.trace.effectiveConfiguration;
  return identityFieldsMatch(floor, request, fingerprint)
    && sameBounds(floor.bounds, request)
    && sameBounds(floor.identity.bounds, request)
    && sameBounds(trace.trace.bounds, request)
    && trace.trace.configurationFingerprint === fingerprint
    && effectiveConfigurationMatches(effective, request);
}

function identityFieldsMatch(
  floor: GeneratedFloorTrace["floor"],
  request: FiniteFloorTraceCacheRequest,
  fingerprint: string,
): boolean {
  return floor.worldSeed === request.worldSeed
    && floor.floor === request.floor
    && floor.voidTerrain === request.voidTerrain
    && floorConfigurationFingerprint(floor.configuration) === fingerprint
    && floor.identity.seed === mixSeeds(request.worldSeed, request.floor, request.config.generatorVersion)
    && floor.identity.generatorVersion === request.config.generatorVersion
    && floor.identity.configurationFingerprint === fingerprint;
}

function effectiveConfigurationMatches(
  effective: GeneratedFloorTrace["trace"]["effectiveConfiguration"],
  request: FiniteFloorTraceCacheRequest,
): boolean {
  return effective !== undefined && JSON.stringify(effective) === JSON.stringify(request.config);
}

export function matchesTrace(trace: GeneratedFloorTrace, request: FiniteFloorTraceCacheRequest, expectedContentFingerprint: string): boolean {
  return matchesIdentity(trace, request)
    && trace.floor.identity.fingerprint === generatedFloorFingerprint(trace.floor)
    && validateTraceSnapshots(trace.trace, trace.floor)
    && traceContentFingerprint(trace.trace) === expectedContentFingerprint;
}

function sameBounds(bounds: GeneratedFloorTrace["floor"]["bounds"], request: FiniteFloorTraceCacheRequest): boolean {
  return boundsExtentMatches(bounds, request) && boundsChunkRangeMatches(bounds);
}

function boundsExtentMatches(
  bounds: GeneratedFloorTrace["floor"]["bounds"],
  request: FiniteFloorTraceCacheRequest,
): boolean {
  const maxX = request.config.minX + request.config.width - 1;
  const maxY = request.config.minY + request.config.height - 1;
  return bounds.minX === request.config.minX && bounds.minY === request.config.minY
    && bounds.width === request.config.width && bounds.height === request.config.height
    && bounds.maxX === maxX && bounds.maxY === maxY;
}

function boundsChunkRangeMatches(bounds: GeneratedFloorTrace["floor"]["bounds"]): boolean {
  return bounds.minChunkX === Math.floor(bounds.minX / 32)
    && bounds.minChunkY === Math.floor(bounds.minY / 32)
    && bounds.maxChunkX === Math.floor(bounds.maxX / 32)
    && bounds.maxChunkY === Math.floor(bounds.maxY / 32);
}

function snapshotContent(snapshot: GeneratedFloorTrace["trace"]["snapshots"][number]) {
  return {
    stageId: snapshot.stageId,
    stageIndex: snapshot.stageIndex,
    fingerprint: snapshot.fingerprint,
    surfaceValidation: snapshot.surfaceValidation,
    bounds: snapshot.bounds,
    metadata: {
      rooms: snapshot.rooms,
      connectors: snapshot.connectors,
      routes: snapshot.routes,
      featureStamps: snapshot.featureStamps,
      territoryLayouts: snapshot.territoryLayouts,
    },
    planes: [
      bytesOf(snapshot.tiles), bytesOf(snapshot.terrain), bytesOf(snapshot.features),
      bytesOf(snapshot.featureFaces), bytesOf(snapshot.featureHeight), bytesOf(snapshot.height),
      bytesOf(snapshot.semantic), bytesOf(snapshot.roomWallIds), bytesOf(snapshot.territory),
      bytesOf(snapshot.region), bytesOf(snapshot.featureIds), bytesOf(snapshot.protectedCells),
    ],
  };
}

function bytesOf(plane: ArrayBufferView): string {
  return Buffer.from(plane.buffer, plane.byteOffset, plane.byteLength).toString("hex");
}
