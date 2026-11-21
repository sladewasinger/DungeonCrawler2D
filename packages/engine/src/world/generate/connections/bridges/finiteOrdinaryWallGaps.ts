import { hash2D } from "../../../../core/rng.js";
import { carveAt, insideBounds, isCarved, localIndex } from "../../finiteFloorBuffers.js";
import { FLOOR_SEMANTIC, type FloorBounds, type FloorBuffers, type FloorPoint } from "../../finiteFloorTypes.js";

interface OrdinaryGapInput {
  readonly buffers: FloorBuffers;
  readonly bounds: FloorBounds;
  readonly seed: number;
  readonly edgeIsLegal: (from: FloorPoint, to: FloorPoint) => boolean;
}

export function openOrdinaryWallGaps(input: OrdinaryGapInput): void {
  for (let y = input.bounds.minY + 1; y < input.bounds.maxY; y++) {
    for (let x = input.bounds.minX + 1; x < input.bounds.maxX; x++) openGapAt(input, { x, y });
  }
}

function openGapAt(input: OrdinaryGapInput, point: FloorPoint): void {
  const index = localIndex({ bounds: input.bounds, ...point });
  if (!ordinaryGapCell(input.buffers, index) || (hash2D(input.seed, point.x, point.y) & 1) !== 0) return;
  const region = sameRegionAcross(input, point, { x: 0, y: 1 }) ?? sameRegionAcross(input, point, { x: 1, y: 0 });
  if (region === null) return;
  carveAt({ buffers: input.buffers, bounds: input.bounds, point, semantic: FLOOR_SEMANTIC.Corridor, regionId: region });
}

function ordinaryGapCell(buffers: FloorBuffers, index: number): boolean {
  return !isCarved(buffers, index)
    && (buffers.roomWallIds[index] ?? -1) < 0
    && (buffers.protectedCells[index] ?? 0) === 0
    && (buffers.features[index] ?? 0) === 0;
}

function sameRegionAcross(input: OrdinaryGapInput, point: FloorPoint, direction: FloorPoint): number | null {
  const first = { x: point.x - direction.x, y: point.y - direction.y };
  const second = { x: point.x + direction.x, y: point.y + direction.y };
  if (!insideBounds({ bounds: input.bounds, ...first }) || !insideBounds({ bounds: input.bounds, ...second })) return null;
  const firstRegion = regionAt(input, first);
  const secondRegion = regionAt(input, second);
  return firstRegion > 0 && firstRegion === secondRegion
    && input.edgeIsLegal(first, point) && input.edgeIsLegal(point, second) ? firstRegion : null;
}

function regionAt(input: OrdinaryGapInput, point: FloorPoint): number {
  const index = localIndex({ bounds: input.bounds, ...point });
  return isCarved(input.buffers, index) ? input.buffers.region[index] ?? 0 : 0;
}
