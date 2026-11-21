import type { FloorGenerationSnapshot } from "../finiteFloorTypes.js";

export const GENERATION_SNAPSHOT_PLANE_NAMES = [
  "tiles", "terrain", "features", "featureFaces", "featureHeight", "height",
  "semantic", "roomWallIds", "territory", "region", "featureIds", "protectedCells",
] as const;

export const GENERATION_SNAPSHOT_METADATA_NAMES = [
  "rooms", "connectors", "routes", "featureStamps", "territoryLayouts",
] as const;

type PlaneName = typeof GENERATION_SNAPSHOT_PLANE_NAMES[number];
type MetadataName = typeof GENERATION_SNAPSHOT_METADATA_NAMES[number];

export interface GenerationSnapshotMetadataDelta {
  readonly added: number;
  readonly removed: number;
  readonly changed: number;
}

export interface GenerationSnapshotDelta {
  readonly cellMask: Uint8Array;
  readonly changedCellCount: number;
  readonly planeChanges: Readonly<Record<PlaneName, number>>;
  readonly metadataChanges: Readonly<Record<MetadataName, GenerationSnapshotMetadataDelta>>;
}

export function generationSnapshotDelta(
  previous: FloorGenerationSnapshot,
  current: FloorGenerationSnapshot,
): GenerationSnapshotDelta {
  const cellCount = current.bounds.width * current.bounds.height;
  if (cellCount !== previous.bounds.width * previous.bounds.height) {
    throw new Error("Generation snapshot delta requires equal bounds");
  }
  const cellMask = new Uint8Array(cellCount);
  const planeChanges = emptyPlaneChanges();
  for (const name of GENERATION_SNAPSHOT_PLANE_NAMES) {
    comparePlane({ previous: previous[name], current: current[name], cellMask, changes: planeChanges, name });
  }
  return {
    cellMask,
    changedCellCount: cellMask.reduce((count, changed) => count + changed, 0),
    planeChanges,
    metadataChanges: metadataDeltas(previous, current),
  };
}

function emptyPlaneChanges(): Record<PlaneName, number> {
  return Object.fromEntries(GENERATION_SNAPSHOT_PLANE_NAMES.map((name) => [name, 0])) as Record<PlaneName, number>;
}

function comparePlane(input: {
  readonly previous: ArrayLike<number>;
  readonly current: ArrayLike<number>;
  readonly cellMask: Uint8Array;
  readonly changes: Record<PlaneName, number>;
  readonly name: PlaneName;
}): void {
  for (let index = 0; index < input.cellMask.length; index++) {
    if (input.previous[index] === input.current[index]) continue;
    input.changes[input.name]++;
    input.cellMask[index] = 1;
  }
}

function metadataDeltas(
  previous: FloorGenerationSnapshot,
  current: FloorGenerationSnapshot,
): Record<MetadataName, GenerationSnapshotMetadataDelta> {
  return Object.fromEntries(GENERATION_SNAPSHOT_METADATA_NAMES.map((name) => [
    name, metadataDelta(previous[name], current[name]),
  ])) as Record<MetadataName, GenerationSnapshotMetadataDelta>;
}

function metadataDelta(previous: readonly unknown[], current: readonly unknown[]): GenerationSnapshotMetadataDelta {
  const shared = Math.min(previous.length, current.length);
  let changed = 0;
  for (let index = 0; index < shared; index++) {
    if (JSON.stringify(previous[index]) !== JSON.stringify(current[index])) changed++;
  }
  return {
    added: Math.max(0, current.length - previous.length),
    removed: Math.max(0, previous.length - current.length),
    changed,
  };
}
