import { hashString } from "../../../core/rng.js";
import type {
  FloorBounds, FloorBuffers, FloorGenerationSnapshot, FloorGenerationStageId,
  FloorGenerationTrace, FloorPoint, FloorSurfaceValidation, GeneratedConnector, GeneratedFeatureStamp,
  GeneratedFloor, GeneratedRoom, GeneratedTerritoryLayout,
  NormalizedFloorGenerationConfig,
} from "../finiteFloorTypes.js";
import { cloneSnapshotMetadata, immutableGenerationSnapshot } from "./finiteFloorGenerationSnapshot.js";
import { copyGenerationSnapshotPlanes, hashGenerationSnapshotPlanes } from "./finiteFloorGenerationSnapshotPlanes.js";

export interface TraceStageInput {
  readonly stageId: FloorGenerationStageId;
  readonly bounds: FloorBounds;
  readonly buffers: FloorBuffers;
  readonly rooms: readonly GeneratedRoom[];
  readonly connectors: readonly GeneratedConnector[];
  readonly routes: readonly (readonly FloorPoint[])[];
  readonly featureStamps: readonly GeneratedFeatureStamp[];
  readonly territoryLayouts: readonly GeneratedTerritoryLayout[];
}

export class FiniteFloorGenerationTraceBuilder {
  private snapshots: FloorGenerationSnapshot[] = [];

  constructor(
    private readonly bounds: FloorBounds,
    private readonly configurationFingerprint: string,
    private readonly effectiveConfiguration: NormalizedFloorGenerationConfig,
  ) {}

  reset(): void {
    this.snapshots = [];
  }

  capture(input: TraceStageInput): void {
    const snapshot = makeSnapshot({ ...input, stageIndex: this.snapshots.length });
    this.snapshots.push(snapshot);
  }

  captureFinal(floor: GeneratedFloor): void {
    this.capture({
      stageId: "final-validated", bounds: floor.bounds, buffers: floor,
      rooms: floor.rooms, connectors: floor.connectors, routes: floor.routes,
      featureStamps: floor.featureStamps, territoryLayouts: floor.territoryLayouts,
    });
  }

  build(): FloorGenerationTrace {
    return Object.freeze({
      bounds: Object.freeze({ ...this.bounds }),
      configurationFingerprint: this.configurationFingerprint,
      effectiveConfiguration: Object.freeze({
        ...this.effectiveConfiguration,
        territoryRoster: Object.freeze([...this.effectiveConfiguration.territoryRoster]),
      }),
      snapshots: Object.freeze([...this.snapshots]),
    });
  }
}

export function captureFloorGenerationStage(
  trace: FiniteFloorGenerationTraceBuilder | undefined,
  input: TraceStageInput,
): void {
  if (trace) trace.capture(input);
}

function makeSnapshot(input: TraceStageInput & { readonly stageIndex: number }): FloorGenerationSnapshot {
  const metadata = cloneSnapshotMetadata(input);
  const surfaceValidation = snapshotSurfaceValidation(input.stageId);
  const planes = copyGenerationSnapshotPlanes(input.buffers);
  const fingerprintSeed = hashString(JSON.stringify({
    stageId: input.stageId, stageIndex: input.stageIndex, bounds: input.bounds,
    metadata, surfaceValidation,
  }));
  const fingerprint = hashGenerationSnapshotPlanes(fingerprintSeed, planes).toString(16);
  return immutableGenerationSnapshot({
    planes, metadata, stageId: input.stageId, stageIndex: input.stageIndex,
    bounds: input.bounds, fingerprint, surfaceValidation,
  });
}

function snapshotSurfaceValidation(stageId: FloorGenerationStageId): FloorSurfaceValidation {
  return Object.freeze({
    status: stageId === "final-validated" ? "validated" : "planning",
    failures: Object.freeze([]),
  });
}
