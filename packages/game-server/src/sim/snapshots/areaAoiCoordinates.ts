import { AOI_RADIUS } from "@dc2d/engine";
import type { AoiCenter } from "../state/state.js";

export interface AreaCoordinate {
  readonly x: number;
  readonly y: number;
}

interface AreaXRange {
  readonly start: number;
  readonly end: number;
}

interface EnteringCoordinateRequest {
  readonly coordinates: AreaCoordinate[];
  readonly y: number;
  readonly current: AreaXRange;
  readonly previous: AreaXRange | null;
}

export function areaCoordinatesWithin(center: AoiCenter): AreaCoordinate[] {
  const coordinates: AreaCoordinate[] = [];
  for (let y = Math.ceil(center.y - AOI_RADIUS); y <= Math.floor(center.y + AOI_RADIUS); y++) {
    const range = areaXRange(center, y);
    if (range) appendAreaCoordinates(coordinates, y, range);
  }
  return coordinates;
}

export function enteringAreaCoordinates(
  current: AoiCenter,
  previous: AoiCenter,
): AreaCoordinate[] {
  const coordinates: AreaCoordinate[] = [];
  for (let y = Math.ceil(current.y - AOI_RADIUS); y <= Math.floor(current.y + AOI_RADIUS); y++) {
    const currentRange = areaXRange(current, y);
    if (!currentRange) continue;
    appendEnteringCoordinates({
      coordinates,
      y,
      current: currentRange,
      previous: areaXRange(previous, y),
    });
  }
  return coordinates;
}

function appendEnteringCoordinates(request: EnteringCoordinateRequest): void {
  const { coordinates, y, current, previous } = request;
  if (!previous) return appendAreaCoordinates(coordinates, y, current);
  appendAreaCoordinates(coordinates, y, {
    start: current.start,
    end: Math.min(current.end, previous.start - 1),
  });
  appendAreaCoordinates(coordinates, y, {
    start: Math.max(current.start, previous.end + 1),
    end: current.end,
  });
}

function appendAreaCoordinates(
  coordinates: AreaCoordinate[],
  y: number,
  range: AreaXRange,
): void {
  for (let x = range.start; x <= range.end; x++) coordinates.push({ x, y });
}

function areaXRange(center: AoiCenter, y: number): AreaXRange | null {
  const halfWidthSquared = AOI_RADIUS ** 2 - (y - center.y) ** 2;
  if (halfWidthSquared < 0) return null;
  const halfWidth = Math.sqrt(halfWidthSquared);
  return {
    start: Math.ceil(center.x - halfWidth),
    end: Math.floor(center.x + halfWidth),
  };
}
