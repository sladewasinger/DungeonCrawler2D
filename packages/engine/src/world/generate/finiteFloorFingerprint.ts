import { forEachCell } from "./finiteFloorBuffers.js";
import type { FloorAttempt, FloorBounds, GeneratedFloor } from "./finiteFloorTypes.js";

export function floorFingerprint(attempt: FloorAttempt, bounds: FloorBounds): string {
  let hash = 2166136261;
  forEachCell(bounds, (_x, _y, index) => {
    hash = fingerprintCell(hash, attempt.buffers, index);
  });
  return (hash >>> 0).toString(16);
}

/** Uses the same cell content contract for reconstructed test artifacts. */
export function generatedFloorFingerprint(floor: GeneratedFloor): string {
  let hash = 2166136261;
  forEachCell(floor.bounds, (_x, _y, index) => {
    hash = fingerprintGeneratedCell(hash, floor, index);
  });
  return (hash >>> 0).toString(16);
}

function fingerprintCell(hash: number, buffers: FloorAttempt["buffers"], index: number): number {
  const values = [
    planeValue(buffers.tiles, index, 0), planeValue(buffers.terrain, index, 0), planeValue(buffers.features, index, 0),
    planeValue(buffers.featureFaces, index, 0), planeValue(buffers.featureHeight, index, 0), planeValue(buffers.height, index, 0),
    planeValue(buffers.zones, index, 0), planeValue(buffers.semantic, index, 0), planeValue(buffers.biome, index, 0),
    planeValue(buffers.territory, index, 0), planeValue(buffers.region, index, 0), planeValue(buffers.protectedCells, index, 0),
    planeValue(buffers.roomIds, index, -1), planeValue(buffers.roomWallIds, index, -1), planeValue(buffers.featureIds, index, -1),
  ];
  return values.reduce(fingerprintValue, hash);
}

function fingerprintGeneratedCell(hash: number, floor: GeneratedFloor, index: number): number {
  const values = [
    planeValue(floor.tiles, index, 0), planeValue(floor.terrain, index, 0), planeValue(floor.features, index, 0),
    planeValue(floor.featureFaces, index, 0), planeValue(floor.featureHeight, index, 0), planeValue(floor.height, index, 0),
    planeValue(floor.zones, index, 0), planeValue(floor.semantic, index, 0), planeValue(floor.biome, index, 0),
    planeValue(floor.territory, index, 0), planeValue(floor.region, index, 0), planeValue(floor.protectedCells, index, 0),
    planeValue(floor.roomIds, index, -1), planeValue(floor.roomWallIds, index, -1), planeValue(floor.featureIds, index, -1),
  ];
  return values.reduce(fingerprintValue, hash);
}

function planeValue(plane: ArrayLike<number>, index: number, fallback: number): number { return plane[index] ?? fallback; }

function fingerprintValue(hash: number, value: number): number {
  return Math.imul(hash ^ Math.round(value * 1000), 16777619);
}
