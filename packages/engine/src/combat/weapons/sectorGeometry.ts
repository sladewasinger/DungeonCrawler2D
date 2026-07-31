export const GEOMETRY_EPSILON = 1e-9;

export interface Point2 {
  readonly x: number;
  readonly y: number;
}

export interface Bounds2 {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export interface SectorGeometry {
  readonly direction: Point2;
  readonly range: number;
  readonly arcCos: number;
}

export interface NormalizedSector extends SectorGeometry {
  readonly direction: Point2;
  readonly halfArc: number;
}

export function normalizedSector(geometry: SectorGeometry): NormalizedSector {
  const length = Math.hypot(geometry.direction.x, geometry.direction.y);
  const direction = length <= 0.001
    ? { x: 1, y: 0 }
    : { x: geometry.direction.x / length, y: geometry.direction.y / length };
  return {
    ...geometry,
    direction,
    arcCos: clamp(geometry.arcCos, -1, 1),
    halfArc: Math.acos(clamp(geometry.arcCos, -1, 1)),
  };
}

export function pointInsideSector(point: Point2, sector: NormalizedSector): boolean {
  const distance = Math.hypot(point.x, point.y);
  if (distance > sector.range + GEOMETRY_EPSILON) return false;
  if (distance <= GEOMETRY_EPSILON) return true;
  return directionDot(point, distance, sector.direction) >=
    sector.arcCos - GEOMETRY_EPSILON;
}

export function diskIntersectsBounds(range: number, bounds: Bounds2): boolean {
  const x = clamp(0, bounds.minX, bounds.maxX);
  const y = clamp(0, bounds.minY, bounds.maxY);
  return x * x + y * y <= range * range + GEOMETRY_EPSILON;
}

export function directionDot(point: Point2, length: number, direction: Point2): number {
  return (point.x * direction.x + point.y * direction.y) / length;
}

export function sectorBoundaryDirections(sector: NormalizedSector): readonly Point2[] {
  return [
    rotate(sector.direction, sector.halfArc),
    rotate(sector.direction, -sector.halfArc),
  ];
}

export function boundsCorners(bounds: Bounds2): readonly Point2[] {
  return [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ];
}

export function pointInsideBounds(point: Point2, bounds: Bounds2): boolean {
  return within(point.x, bounds.minX, bounds.maxX) &&
    within(point.y, bounds.minY, bounds.maxY);
}

export function within(value: number, minimum: number, maximum: number): boolean {
  return value >= minimum - GEOMETRY_EPSILON && value <= maximum + GEOMETRY_EPSILON;
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function rotate(point: Point2, radians: number): Point2 {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: point.x * cosine - point.y * sine,
    y: point.x * sine + point.y * cosine,
  };
}
