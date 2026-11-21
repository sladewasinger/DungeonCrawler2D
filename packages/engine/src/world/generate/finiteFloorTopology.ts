import { localIndex } from "./finiteFloorBuffers.js";
import { profileForBiome } from "./finiteFloorBiomeProfiles.js";
import { carvedPaths } from "./finiteFloorPath.js";
import type { FloorBounds, FloorBuffers, FloorPoint } from "./finiteFloorTypes.js";

export { profileForBiome };

export function floorStart(input: {
  readonly floor: number;
  readonly bounds: FloorBounds;
  readonly upStair: FloorPoint | null;
  readonly spawnExterior: FloorPoint | null;
  readonly firstRoom: FloorPoint | null;
}): FloorPoint {
  if (input.floor < 1) return input.firstRoom ?? center(input.bounds);
  return input.upStair ?? input.spawnExterior ?? center(input.bounds);
}

export function protectRequiredRoutes(input: {
  readonly buffers: FloorBuffers;
  readonly bounds: FloorBounds;
  readonly spawn: FloorPoint;
  readonly targets: readonly FloorPoint[];
}): FloorPoint[][] {
  const targets = input.targets.map(integerPoint);
  const paths = carvedPaths({ buffers: input.buffers, bounds: input.bounds, from: integerPoint(input.spawn), targets });
  const routes: FloorPoint[][] = [];
  for (const path of paths) {
    if (path.length === 0) continue;
    protectPath(input.buffers, input.bounds, path);
    routes.push(path);
  }
  return routes;
}

function protectPath(buffers: FloorBuffers, bounds: FloorBounds, path: readonly FloorPoint[]): void {
  for (const point of path) buffers.protectedCells[localIndex({ bounds, ...point })] = 1;
}

function integerPoint(point: FloorPoint): FloorPoint {
  return { x: Math.floor(point.x), y: Math.floor(point.y) };
}

function center(bounds: FloorBounds): FloorPoint {
  return { x: Math.floor((bounds.minX + bounds.maxX) / 2), y: Math.floor((bounds.minY + bounds.maxY) / 2) };
}
