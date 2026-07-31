import {
  clamp,
  GEOMETRY_EPSILON,
  type Bounds2,
  type Point2,
} from "./sectorGeometry.js";

interface Segment {
  readonly start: Point2;
  readonly end: Point2;
}

export function segmentIntersectsBounds(segment: Segment, bounds: Bounds2): boolean {
  const axisClips = segmentAxisClips(segment, bounds);
  let interval = { minimum: 0, maximum: 1 };
  for (const clip of axisClips) {
    const result = clipInterval(interval, clip);
    if (!result) return false;
    interval = result;
  }
  return true;
}

export function pointSegmentDistanceSquared(point: Point2, segment: Segment): number {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const squaredLength = dx * dx + dy * dy;
  if (squaredLength <= GEOMETRY_EPSILON) return squaredDistance(point, segment.start);
  const projection = ((point.x - segment.start.x) * dx +
    (point.y - segment.start.y) * dy) / squaredLength;
  const ratio = clamp(projection, 0, 1);
  return squaredDistance(point, {
    x: segment.start.x + ratio * dx,
    y: segment.start.y + ratio * dy,
  });
}

interface AxisClip {
  readonly direction: number;
  readonly distance: number;
}

interface ClipInterval {
  readonly minimum: number;
  readonly maximum: number;
}

function segmentAxisClips(segment: Segment, bounds: Bounds2): readonly AxisClip[] {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  return [
    { direction: -dx, distance: segment.start.x - bounds.minX },
    { direction: dx, distance: bounds.maxX - segment.start.x },
    { direction: -dy, distance: segment.start.y - bounds.minY },
    { direction: dy, distance: bounds.maxY - segment.start.y },
  ];
}

function clipInterval(interval: ClipInterval, clip: AxisClip): ClipInterval | null {
  if (Math.abs(clip.direction) <= GEOMETRY_EPSILON) {
    return clip.distance < 0 ? null : interval;
  }
  const ratio = clip.distance / clip.direction;
  const minimum = clip.direction < 0 ? Math.max(interval.minimum, ratio) : interval.minimum;
  const maximum = clip.direction > 0 ? Math.min(interval.maximum, ratio) : interval.maximum;
  return minimum <= maximum + GEOMETRY_EPSILON ? { minimum, maximum } : null;
}

function squaredDistance(first: Point2, second: Point2): number {
  const dx = first.x - second.x;
  const dy = first.y - second.y;
  return dx * dx + dy * dy;
}
