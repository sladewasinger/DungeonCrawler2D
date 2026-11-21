import {
  carveAt, insideBounds, isCarved, localIndex, protectLine,
} from "./finiteFloorBuffers.js";
import { FLOOR_SEMANTIC, type FloorBounds, type FloorBuffers, type FloorPoint, type GeneratedFeatureStamp } from "./finiteFloorTypes.js";

interface FeatureRegionInput {
  readonly buffers: FloorBuffers;
  readonly bounds: FloorBounds;
}

export function reserveFeatureRegions(input: FeatureRegionInput & {
  readonly features: readonly GeneratedFeatureStamp[];
}): number {
  input.features.forEach((feature, index) => stampFeatureRegion(input, feature, index + 1));
  return input.features.length + 1;
}

function stampFeatureRegion(input: FeatureRegionInput, feature: GeneratedFeatureStamp, regionId: number): void {
  for (let y = feature.bounds.y0; y <= feature.bounds.y1; y++) {
    for (let x = feature.bounds.x0; x <= feature.bounds.x1; x++) assignExistingCell(input, { x, y }, regionId);
  }
  for (const port of feature.ports) carveFeatureApproach({ ...input, feature, port, regionId });
}

function assignExistingCell(input: FeatureRegionInput, point: FloorPoint, regionId: number): void {
  if (!insideBounds({ bounds: input.bounds, ...point })) return;
  const index = localIndex({ bounds: input.bounds, ...point });
  if (isCarved(input.buffers, index)) input.buffers.region[index] = regionId;
}

function carveFeatureApproach(input: FeatureRegionInput & {
  readonly feature: GeneratedFeatureStamp;
  readonly port: FloorPoint;
  readonly regionId: number;
}): void {
  const direction = outwardDirection(input.feature, input.port);
  const end = alignToMaze({ x: input.port.x + direction.x * 3, y: input.port.y + direction.y * 3 }, direction);
  carveRegionLine({ ...input, from: input.port, to: end });
  protectLine({ buffers: input.buffers, bounds: input.bounds, from: input.port, to: end });
}

function outwardDirection(feature: GeneratedFeatureStamp, port: FloorPoint): FloorPoint {
  if (port.y >= feature.bounds.y1) return { x: 0, y: 1 };
  if (port.y <= feature.bounds.y0) return { x: 0, y: -1 };
  if (port.x >= feature.bounds.x1) return { x: 1, y: 0 };
  return { x: -1, y: 0 };
}

function alignToMaze(point: FloorPoint, direction: FloorPoint): FloorPoint {
  if (direction.x === 0 && Math.abs(point.x % 2) !== 1) return { x: point.x + 1, y: point.y };
  if (direction.y === 0 && Math.abs(point.y % 2) !== 1) return { x: point.x, y: point.y + 1 };
  return point;
}

function carveRegionLine(input: FeatureRegionInput & {
  readonly from: FloorPoint;
  readonly to: FloorPoint;
  readonly regionId: number;
}): void {
  let point = { ...input.from };
  while (point.x !== input.to.x || point.y !== input.to.y) {
    carveTransition(input, point);
    point = nextLinePoint(point, input.to);
  }
  carveTransition(input, point);
}

function carveTransition(input: FeatureRegionInput & { readonly regionId: number }, point: FloorPoint): void {
  carveAt({ buffers: input.buffers, bounds: input.bounds, point, semantic: FLOOR_SEMANTIC.Transition, regionId: input.regionId });
}

function nextLinePoint(point: FloorPoint, target: FloorPoint): FloorPoint {
  return point.x !== target.x
    ? { x: point.x + Math.sign(target.x - point.x), y: point.y }
    : { x: point.x, y: point.y + Math.sign(target.y - point.y) };
}
