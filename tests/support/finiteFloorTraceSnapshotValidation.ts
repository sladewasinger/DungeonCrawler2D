import { hashString } from "../../packages/engine/src/core/rng.js";
import type {
  FloorGenerationSnapshot,
  FloorGenerationTrace,
  GeneratedFloor,
} from "../../packages/engine/src/world/generate/finiteFloor.js";

const TRACE_STAGE_IDS = [
  "mandatory-backbone", "rooms-envelopes", "maze-fill", "region-connectivity",
  "loops-dead-ends-elevation", "final-validated",
] as const;

export function validateTraceSnapshots(trace: FloorGenerationTrace, floor: GeneratedFloor): boolean {
  const expectedLength = floor.bounds.width * floor.bounds.height;
  return trace.snapshots.length === TRACE_STAGE_IDS.length
    && trace.snapshots.every((snapshot, index) => validSnapshot({ snapshot, index, expectedLength, floor }))
    && finalSnapshotMatchesFloor(trace.snapshots.at(-1), floor);
}

function validSnapshot(input: {
  readonly snapshot: FloorGenerationSnapshot;
  readonly index: number;
  readonly expectedLength: number;
  readonly floor: GeneratedFloor;
}): boolean {
  const { snapshot, index, expectedLength, floor } = input;
  const planes = snapshotPlanes(snapshot);
  const metadata = snapshotMetadata(snapshot);
  return snapshot.stageId === TRACE_STAGE_IDS[index]
    && snapshot.stageIndex === index
    && sameBounds(snapshot.bounds, floor.bounds)
    && typedPlaneLengths(planes, expectedLength)
    && metadataIsValid(metadata)
    && snapshot.fingerprint === snapshotFingerprint(snapshot, metadata, planes);
}

function snapshotPlanes(snapshot: FloorGenerationSnapshot) {
  return {
    tiles: snapshot.tiles, terrain: snapshot.terrain, features: snapshot.features,
    featureFaces: snapshot.featureFaces, featureHeight: snapshot.featureHeight,
    height: snapshot.height, semantic: snapshot.semantic,
    roomWallIds: snapshot.roomWallIds, territory: snapshot.territory,
    region: snapshot.region, featureIds: snapshot.featureIds,
    protectedCells: snapshot.protectedCells,
  };
}

function snapshotMetadata(snapshot: FloorGenerationSnapshot) {
  return {
    rooms: snapshot.rooms, connectors: snapshot.connectors, routes: snapshot.routes,
    featureStamps: snapshot.featureStamps, territoryLayouts: snapshot.territoryLayouts,
  };
}

function typedPlaneLengths(planes: ReturnType<typeof snapshotPlanes>, expectedLength: number): boolean {
  const typed = [
    planes.tiles instanceof Uint8Array, planes.terrain instanceof Uint8Array,
    planes.features instanceof Uint8Array, planes.featureFaces instanceof Uint8Array,
    planes.featureHeight instanceof Float32Array, planes.height instanceof Float32Array,
    planes.semantic instanceof Uint8Array, planes.roomWallIds instanceof Int16Array,
    planes.territory instanceof Uint8Array, planes.region instanceof Uint16Array,
    planes.featureIds instanceof Int16Array, planes.protectedCells instanceof Uint8Array,
  ];
  return typed.every(Boolean) && Object.values(planes).every((plane) => plane.length === expectedLength);
}

function metadataIsValid(metadata: ReturnType<typeof snapshotMetadata>): boolean {
  return Array.isArray(metadata.rooms)
    && Array.isArray(metadata.connectors)
    && Array.isArray(metadata.routes)
    && Array.isArray(metadata.featureStamps)
    && Array.isArray(metadata.territoryLayouts)
    && metadata.routes.every((route) => Array.isArray(route) && route.every(isPoint))
    && JSON.stringify(metadata) !== undefined;
}

function isPoint(point: unknown): boolean {
  if (!point || typeof point !== "object") return false;
  const candidate = point as { x?: unknown; y?: unknown };
  return typeof candidate.x === "number" && Number.isFinite(candidate.x)
    && typeof candidate.y === "number" && Number.isFinite(candidate.y);
}

function snapshotFingerprint(
  snapshot: FloorGenerationSnapshot,
  metadata: ReturnType<typeof snapshotMetadata>,
  planes: ReturnType<typeof snapshotPlanes>,
): string {
  const seed = hashString(JSON.stringify({
    stageId: snapshot.stageId, stageIndex: snapshot.stageIndex, bounds: snapshot.bounds,
    metadata, surfaceValidation: snapshot.surfaceValidation,
  }));
  return hashPlanes(seed, planes).toString(16);
}

export function snapshotContentFingerprintForTest(snapshot: FloorGenerationSnapshot): string {
  return snapshotFingerprint(snapshot, snapshotMetadata(snapshot), snapshotPlanes(snapshot));
}

function hashPlanes(seed: number, planes: ReturnType<typeof snapshotPlanes>): number {
  return Object.values(planes).reduce((hash, plane) => hashBytes(hash, plane), seed);
}

function hashBytes(seed: number, plane: ArrayBufferView): number {
  const bytes = new Uint8Array(plane.buffer, plane.byteOffset, plane.byteLength);
  let hash = Math.imul(seed ^ plane.byteLength, 16777619) >>> 0;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  return hash;
}

function finalSnapshotMatchesFloor(snapshot: FloorGenerationSnapshot | undefined, floor: GeneratedFloor): boolean {
  if (!snapshot) return false;
  const snapshotMetadataValue = snapshotMetadata(snapshot);
  const floorMetadata = {
    rooms: floor.rooms, connectors: floor.connectors, routes: floor.routes,
    featureStamps: floor.featureStamps, territoryLayouts: floor.territoryLayouts,
  };
  const planePairs: readonly (readonly [ArrayLike<number>, ArrayLike<number>])[] = [
    [snapshot.tiles, floor.tiles], [snapshot.terrain, floor.terrain],
    [snapshot.features, floor.features], [snapshot.featureFaces, floor.featureFaces],
    [snapshot.featureHeight, floor.featureHeight], [snapshot.height, floor.height],
    [snapshot.semantic, floor.semantic], [snapshot.roomWallIds, floor.roomWallIds],
    [snapshot.territory, floor.territory], [snapshot.region, floor.region],
    [snapshot.featureIds, floor.featureIds], [snapshot.protectedCells, floor.protectedCells],
  ];
  const validation = snapshot.surfaceValidation;
  return planePairs.every(([left, right]) => sameValues(left, right))
    && validation.status === "validated" && validation.failures.length === 0
    && JSON.stringify(snapshotMetadataValue) === JSON.stringify(floorMetadata);
}

function sameBounds(left: FloorGenerationSnapshot["bounds"], right: GeneratedFloor["bounds"]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sameValues(left: ArrayLike<number>, right: ArrayLike<number>): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}
