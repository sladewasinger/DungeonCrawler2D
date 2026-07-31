import {
  sectorArcIntersectsBounds,
  sectorArcTouchesCircle,
  sectorBoundaryIntersectsBounds,
  sectorBoundaryTouchesCircle,
} from "./sectorBoundaryIntersection.js";
import {
  boundsCorners,
  diskIntersectsBounds,
  GEOMETRY_EPSILON,
  normalizedSector,
  pointInsideBounds,
  pointInsideSector,
  type Bounds2,
  type Point2,
  type SectorGeometry,
} from "./sectorGeometry.js";

export { diskIntersectsBounds, type Bounds2 } from "./sectorGeometry.js";

export function sectorIntersectsBounds(
  geometry: SectorGeometry,
  bounds: Bounds2,
): boolean {
  if (!diskIntersectsBounds(geometry.range, bounds)) return false;
  if (pointInsideBounds({ x: 0, y: 0 }, bounds)) return true;
  const sector = normalizedSector(geometry);
  if (boundsCorners(bounds).some((point) => pointInsideSector(point, sector))) return true;
  if (sectorBoundaryIntersectsBounds(sector, bounds)) return true;
  return sectorArcIntersectsBounds(sector, bounds);
}

export function sectorIntersectsCircle(
  geometry: SectorGeometry,
  center: Point2,
  radius: number,
): boolean {
  const sector = normalizedSector(geometry);
  const centerDistance = Math.hypot(center.x, center.y);
  if (centerDistance <= radius + GEOMETRY_EPSILON) return true;
  if (pointInsideSector(center, sector)) return true;
  const circle = { center, radius };
  if (sectorBoundaryTouchesCircle(sector, circle)) return true;
  return sectorArcTouchesCircle(sector, { ...circle, centerDistance });
}
