import type {
  FloorBounds, FloorGenerationSnapshot, FloorSurfaceValidation,
} from "../finiteFloorTypes.js";
import type { GenerationSnapshotPlanes } from "./finiteFloorGenerationSnapshotPlanes.js";

type SnapshotMetadata = Pick<FloorGenerationSnapshot,
  "rooms" | "connectors" | "routes" | "featureStamps" | "territoryLayouts">;

interface ImmutableSnapshotInput {
  readonly planes: GenerationSnapshotPlanes;
  readonly metadata: SnapshotMetadata;
  readonly stageId: FloorGenerationSnapshot["stageId"];
  readonly stageIndex: number;
  readonly bounds: FloorBounds;
  readonly fingerprint: string;
  readonly surfaceValidation: FloorSurfaceValidation;
}

export function immutableGenerationSnapshot(input: ImmutableSnapshotInput): FloorGenerationSnapshot {
  const snapshot = {
    stageId: input.stageId, stageIndex: input.stageIndex, fingerprint: input.fingerprint,
  } as FloorGenerationSnapshot;
  Object.defineProperties(snapshot, {
    bounds: accessor(() => ({ ...input.bounds })),
    ...planeAccessors(input.planes),
    surfaceValidation: accessor(() => copySurfaceValidation(input.surfaceValidation)),
    ...metadataAccessors(input.metadata),
  });
  return Object.freeze(snapshot);
}

function planeAccessors(planes: GenerationSnapshotPlanes): PropertyDescriptorMap {
  return {
    tiles: accessor(() => planes.tiles.slice()), terrain: accessor(() => planes.terrain.slice()),
    features: accessor(() => planes.features.slice()), featureFaces: accessor(() => planes.featureFaces.slice()),
    featureHeight: accessor(() => planes.featureHeight.slice()), height: accessor(() => planes.height.slice()),
    semantic: accessor(() => planes.semantic.slice()), roomWallIds: accessor(() => planes.roomWallIds.slice()),
    territory: accessor(() => planes.territory.slice()), region: accessor(() => planes.region.slice()),
    featureIds: accessor(() => planes.featureIds.slice()), protectedCells: accessor(() => planes.protectedCells.slice()),
  };
}

function metadataAccessors(metadata: SnapshotMetadata): PropertyDescriptorMap {
  return {
    rooms: accessor(() => cloneSnapshotMetadata(metadata).rooms),
    connectors: accessor(() => cloneSnapshotMetadata(metadata).connectors),
    routes: accessor(() => cloneSnapshotMetadata(metadata).routes),
    featureStamps: accessor(() => cloneSnapshotMetadata(metadata).featureStamps),
    territoryLayouts: accessor(() => cloneSnapshotMetadata(metadata).territoryLayouts),
  };
}

function accessor(get: () => unknown): PropertyDescriptor {
  return { enumerable: true, get };
}

export function cloneSnapshotMetadata(input: SnapshotMetadata): SnapshotMetadata {
  return JSON.parse(JSON.stringify({
    rooms: input.rooms, connectors: input.connectors, routes: input.routes,
    featureStamps: input.featureStamps, territoryLayouts: input.territoryLayouts,
  })) as SnapshotMetadata;
}

function copySurfaceValidation(validation: FloorSurfaceValidation): FloorSurfaceValidation {
  return Object.freeze({
    status: validation.status,
    failures: Object.freeze([...validation.failures]),
  });
}
