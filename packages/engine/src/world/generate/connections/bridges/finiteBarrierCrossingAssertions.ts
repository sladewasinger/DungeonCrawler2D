import type { FloorGenerationSnapshot } from "../../finiteFloorTypes.js";

type SnapshotPlanes = Pick<FloorGenerationSnapshot, "semantic" | "roomWallIds">;

interface ScanOrientationInput {
  readonly snapshot: FloorGenerationSnapshot;
  readonly planes: SnapshotPlanes;
  readonly horizontal: boolean;
}

interface ScanLineInput extends ScanOrientationInput {
  readonly outer: number;
}

interface BarrierCellInput extends ScanLineInput {
  readonly inner: number;
}

export function longestOrdinaryBarrier(snapshot: FloorGenerationSnapshot): number {
  const planes: SnapshotPlanes = { semantic: snapshot.semantic, roomWallIds: snapshot.roomWallIds };
  return Math.max(
    scanOrientation({ snapshot, planes, horizontal: true }),
    scanOrientation({ snapshot, planes, horizontal: false }),
  );
}

function scanOrientation(input: ScanOrientationInput): number {
  const outerLimit = input.horizontal ? input.snapshot.bounds.height : input.snapshot.bounds.width;
  let longest = 0;
  for (let outer = 1; outer < outerLimit - 1; outer += 1) {
    longest = Math.max(longest, scanLine({ ...input, outer }));
  }
  return longest;
}

function scanLine(input: ScanLineInput): number {
  const innerLimit = input.horizontal ? input.snapshot.bounds.width : input.snapshot.bounds.height;
  let current = 0;
  let longest = 0;
  for (let inner = 1; inner < innerLimit - 1; inner += 1) {
    current = isOrdinaryBarrier({ ...input, inner }) ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return longest;
}

function isOrdinaryBarrier(input: BarrierCellInput): boolean {
  const bounds = input.snapshot.bounds;
  const point = input.horizontal
    ? { x: bounds.minX + input.inner, y: bounds.minY + input.outer }
    : { x: bounds.minX + input.outer, y: bounds.minY + input.inner };
  const index = snapshotIndex(input.snapshot, point.x, point.y);
  if (index < 0) return false;
  const semantic = input.planes.semantic[index];
  const roomWallId = input.planes.roomWallIds[index];
  if (semantic !== 0 || roomWallId === undefined || roomWallId >= 0) return false;
  const sides = input.horizontal
    ? [{ x: point.x, y: point.y - 1 }, { x: point.x, y: point.y + 1 }]
    : [{ x: point.x - 1, y: point.y }, { x: point.x + 1, y: point.y }];
  return sides.every((side) => isWalkable(input.snapshot, input.planes, side));
}

function isWalkable(snapshot: FloorGenerationSnapshot, planes: SnapshotPlanes, point: { readonly x: number; readonly y: number }): boolean {
  const index = snapshotIndex(snapshot, point.x, point.y);
  return index >= 0 && (planes.semantic[index] ?? 0) > 0;
}

function snapshotIndex(snapshot: FloorGenerationSnapshot, x: number, y: number): number {
  if (x < snapshot.bounds.minX || x > snapshot.bounds.maxX || y < snapshot.bounds.minY || y > snapshot.bounds.maxY) return -1;
  return (y - snapshot.bounds.minY) * snapshot.bounds.width + x - snapshot.bounds.minX;
}
