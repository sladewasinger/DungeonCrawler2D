import type { FloorBuffers } from "../finiteFloorTypes.js";

export interface GenerationSnapshotPlanes {
  readonly tiles: Uint8Array;
  readonly terrain: Uint8Array;
  readonly features: Uint8Array;
  readonly featureFaces: Uint8Array;
  readonly featureHeight: Float32Array;
  readonly height: Float32Array;
  readonly semantic: Uint8Array;
  readonly roomWallIds: Int16Array;
  readonly territory: Uint8Array;
  readonly region: Uint16Array;
  readonly featureIds: Int16Array;
  readonly protectedCells: Uint8Array;
}

export function copyGenerationSnapshotPlanes(buffers: FloorBuffers): GenerationSnapshotPlanes {
  return {
    tiles: buffers.tiles.slice(), terrain: buffers.terrain.slice(),
    features: buffers.features.slice(), featureFaces: buffers.featureFaces.slice(),
    featureHeight: buffers.featureHeight.slice(), height: buffers.height.slice(),
    semantic: buffers.semantic.slice(), roomWallIds: buffers.roomWallIds.slice(),
    territory: buffers.territory.slice(), region: buffers.region.slice(),
    featureIds: buffers.featureIds.slice(), protectedCells: buffers.protectedCells.slice(),
  };
}

export function hashGenerationSnapshotPlanes(seed: number, planes: GenerationSnapshotPlanes): number {
  return orderedPlanes(planes).reduce((hash, plane) => hashBytes(hash, plane), seed);
}

function orderedPlanes(planes: GenerationSnapshotPlanes): readonly ArrayBufferView[] {
  return [
    planes.tiles, planes.terrain, planes.features, planes.featureFaces, planes.featureHeight,
    planes.height, planes.semantic, planes.roomWallIds, planes.territory, planes.region,
    planes.featureIds, planes.protectedCells,
  ];
}

function hashBytes(seed: number, plane: ArrayBufferView): number {
  const bytes = new Uint8Array(plane.buffer, plane.byteOffset, plane.byteLength);
  let hash = Math.imul(seed ^ plane.byteLength, 16777619) >>> 0;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  return hash;
}
