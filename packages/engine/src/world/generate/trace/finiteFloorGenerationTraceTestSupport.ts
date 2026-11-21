import type { FloorGenerationSnapshot, FloorGenerationTrace } from "../finiteFloor.js";

const HEX_BYTES = Array.from(
  { length: 256 },
  (_, value) => value.toString(16).padStart(2, "0"),
);

export interface SnapshotMutationValues {
  readonly tile: number | undefined;
  readonly protectedCell: number | undefined;
  readonly height: number | undefined;
  readonly roomX: number | undefined;
  readonly routeX: number | undefined;
  readonly territoryLabel: string | undefined;
}

export function snapshotMutationValues(snapshot: FloorGenerationSnapshot): SnapshotMutationValues {
  return {
    tile: snapshot.tiles[0],
    protectedCell: snapshot.protectedCells[0],
    height: snapshot.height[0],
    roomX: snapshot.rooms[0]?.center.x,
    routeX: snapshot.routes[0]?.[0]?.x,
    territoryLabel: snapshot.territoryLayouts[0]?.label,
  };
}

export function mutateSnapshotForTest(snapshot: FloorGenerationSnapshot): void {
  mutateSnapshotPlanes(snapshot);

  const room = snapshot.rooms[0] as { center: { x: number } } | undefined;
  if (room) room.center.x += 100;

  const routePoint = snapshot.routes[0]?.[0] as { x: number } | undefined;
  if (routePoint) routePoint.x += 100;

  const territory = snapshot.territoryLayouts[0] as { label: string } | undefined;
  if (territory) territory.label = "mutated";
}

function mutateSnapshotPlanes(snapshot: FloorGenerationSnapshot): void {
  const tiles = snapshot.tiles as Uint8Array;
  if (tiles.length > 0) tiles[0] = (tiles[0] ?? 0) + 1;

  const protectedCells = snapshot.protectedCells as Uint8Array;
  if (protectedCells.length > 0) protectedCells[0] = (protectedCells[0] ?? 0) + 1;

  const height = snapshot.height as Float32Array;
  if (height.length > 0) height[0] = (height[0] ?? 0) + 100;
}

export function serializeTraceBytes(trace: FloorGenerationTrace): string {
  return JSON.stringify({
    bounds: trace.bounds,
    configurationFingerprint: trace.configurationFingerprint,
    snapshots: trace.snapshots.map(serializeSnapshot),
  });
}

function serializeSnapshot(snapshot: FloorGenerationSnapshot) {
  return {
    stageId: snapshot.stageId,
    stageIndex: snapshot.stageIndex,
    fingerprint: snapshot.fingerprint,
    surfaceValidation: snapshot.surfaceValidation,
    metadata: serializeMetadata(snapshot),
    planes: serializePlanes(snapshot),
  };
}

function serializeMetadata(snapshot: FloorGenerationSnapshot) {
  return {
    rooms: snapshot.rooms,
    connectors: snapshot.connectors,
    routes: snapshot.routes,
    featureStamps: snapshot.featureStamps,
    territoryLayouts: snapshot.territoryLayouts,
  };
}

function serializePlanes(snapshot: FloorGenerationSnapshot): readonly string[] {
  return [
    bytesOf(snapshot.tiles),
    bytesOf(snapshot.terrain),
    bytesOf(snapshot.features),
    bytesOf(snapshot.featureFaces),
    bytesOf(snapshot.featureHeight),
    bytesOf(snapshot.height),
    bytesOf(snapshot.semantic),
    bytesOf(snapshot.roomWallIds),
    bytesOf(snapshot.territory),
    bytesOf(snapshot.region),
    bytesOf(snapshot.featureIds),
    bytesOf(snapshot.protectedCells),
  ];
}

function bytesOf(plane: ArrayBufferView): string {
  const bytes = new Uint8Array(plane.buffer, plane.byteOffset, plane.byteLength);
  let encoded = "";
  for (const value of bytes) encoded += HEX_BYTES[value];
  return encoded;
}
