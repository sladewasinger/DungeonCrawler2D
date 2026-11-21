import type { GeneratedFloor } from "@dc2d/engine";

export function fingerprintForFloor(floor: GeneratedFloor): string {
  let hash = 2166136261;
  const length = floor.bounds.width * floor.bounds.height;
  for (let index = 0; index < length; index++) {
    for (const value of fingerprintValues(floor, index)) {
      hash = Math.imul(hash ^ Math.round(value * 1000), 16777619);
    }
  }
  return (hash >>> 0).toString(16);
}

function fingerprintValues(floor: GeneratedFloor, index: number): number[] {
  return [
    readPlaneValue(floor.tiles, index), readPlaneValue(floor.terrain, index), readPlaneValue(floor.features, index),
    readPlaneValue(floor.featureFaces, index), readPlaneValue(floor.featureHeight, index), readPlaneValue(floor.height, index),
    readPlaneValue(floor.zones, index), readPlaneValue(floor.semantic, index), readPlaneValue(floor.biome, index),
    readPlaneValue(floor.territory, index), readPlaneValue(floor.region, index), readPlaneValue(floor.protectedCells, index),
    readPlaneValue(floor.roomIds, index, -1), readPlaneValue(floor.roomWallIds, index, -1), readPlaneValue(floor.featureIds, index, -1),
  ];
}

function readPlaneValue(plane: ArrayLike<number>, index: number, fallback = 0): number {
  return plane[index] ?? fallback;
}
