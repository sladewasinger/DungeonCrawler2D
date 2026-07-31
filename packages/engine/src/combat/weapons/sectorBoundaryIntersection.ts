import {
  directionDot,
  GEOMETRY_EPSILON,
  pointInsideSector,
  sectorBoundaryDirections,
  within,
  type Bounds2,
  type NormalizedSector,
  type Point2,
} from "./sectorGeometry.js";
import {
  pointSegmentDistanceSquared,
  segmentIntersectsBounds,
} from "./segmentIntersection.js";

export function sectorBoundaryIntersectsBounds(
  sector: NormalizedSector,
  bounds: Bounds2,
): boolean {
  if (isFullCircle(sector)) return false;
  return sectorBoundaryDirections(sector).some((direction) =>
    segmentIntersectsBounds(sectorSegment(sector, direction), bounds));
}

export function sectorArcIntersectsBounds(
  sector: NormalizedSector,
  bounds: Bounds2,
): boolean {
  return verticalArcIntersections(sector.range, bounds).some((point) =>
    pointInsideSector(point, sector)) ||
    horizontalArcIntersections(sector.range, bounds).some((point) =>
      pointInsideSector(point, sector));
}

export function sectorBoundaryTouchesCircle(
  sector: NormalizedSector,
  circle: { readonly center: Point2; readonly radius: number },
): boolean {
  if (isFullCircle(sector)) return false;
  return sectorBoundaryDirections(sector).some((direction) =>
    pointSegmentDistanceSquared(
      circle.center,
      sectorSegment(sector, direction),
    ) <= circle.radius * circle.radius + GEOMETRY_EPSILON);
}

interface ArcCircleContact {
  readonly center: Point2;
  readonly radius: number;
  readonly centerDistance: number;
}

export function sectorArcTouchesCircle(
  sector: NormalizedSector,
  contact: ArcCircleContact,
): boolean {
  if (directionDot(contact.center, contact.centerDistance, sector.direction) <
    sector.arcCos - GEOMETRY_EPSILON) return false;
  return Math.abs(contact.centerDistance - sector.range) <=
    contact.radius + GEOMETRY_EPSILON;
}

function sectorSegment(sector: NormalizedSector, direction: Point2) {
  return {
    start: { x: 0, y: 0 },
    end: { x: direction.x * sector.range, y: direction.y * sector.range },
  };
}

function verticalArcIntersections(range: number, bounds: Bounds2): Point2[] {
  return [bounds.minX, bounds.maxX].flatMap((x) =>
    pairedArcIntersections(range * range - x * x, bounds.minY, bounds.maxY)
      .map((y) => ({ x, y })));
}

function horizontalArcIntersections(range: number, bounds: Bounds2): Point2[] {
  return [bounds.minY, bounds.maxY].flatMap((y) =>
    pairedArcIntersections(range * range - y * y, bounds.minX, bounds.maxX)
      .map((x) => ({ x, y })));
}

function pairedArcIntersections(
  squaredValue: number,
  minimum: number,
  maximum: number,
): number[] {
  if (squaredValue < -GEOMETRY_EPSILON) return [];
  const value = Math.sqrt(Math.max(0, squaredValue));
  return [value, -value].filter((candidate) => within(candidate, minimum, maximum));
}

function isFullCircle(sector: NormalizedSector): boolean {
  return sector.halfArc >= Math.PI - GEOMETRY_EPSILON;
}
