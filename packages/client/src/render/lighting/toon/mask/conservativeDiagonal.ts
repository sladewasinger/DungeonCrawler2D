import {
  signedTwiceArea,
  type MaskOccupancy,
  type ToonMaskPoint,
} from "./contourTypes.js";
import {
  isConservativeDiagonal,
  type StaircaseCandidate,
} from "./conservativeDiagonalSafety.js";

const MINIMUM_STAIRCASE_SEGMENTS = 4;

export interface ConservativeDiagonalRequest {
  readonly path: readonly ToonMaskPoint[];
  readonly occupancy: MaskOccupancy;
}

export function simplifyConservativeDiagonal(
  request: ConservativeDiagonalRequest,
): ToonMaskPoint[] {
  if (signedTwiceArea(request.path) <= 0) return [...request.path];
  const start = stablePathStart(request.path);
  if (start === null) return [...request.path];
  return simplifyRotatedPath({
    path: rotatePath(request.path, start),
    occupancy: request.occupancy,
  });
}

function stablePathStart(path: readonly ToonMaskPoint[]): number | null {
  for (let index = 0; index < path.length; index += 1) {
    if (!startsStaircase(path, index)) return (index + 1) % path.length;
  }
  return null;
}

function startsStaircase(
  path: readonly ToonMaskPoint[],
  index: number,
): boolean {
  const first = cardinalDirection(path[index], path[(index + 1) % path.length]);
  const second = cardinalDirection(
    path[(index + 1) % path.length],
    path[(index + 2) % path.length],
  );
  return first !== null && second !== null && first % 2 !== second % 2;
}

function simplifyRotatedPath(request: ConservativeDiagonalRequest): ToonMaskPoint[] {
  const result: ToonMaskPoint[] = [request.path[0] as ToonMaskPoint];
  let segment = 0;
  while (segment < request.path.length) {
    const candidate = staircaseCandidateAt({ ...request, start: segment });
    appendSimplifiedPoint({ result, path: request.path, segment, candidate });
    segment += candidate?.count ?? 1;
  }
  return result;
}

function staircaseCandidateAt(request: {
  readonly path: readonly ToonMaskPoint[];
  readonly occupancy: MaskOccupancy;
  readonly start: number;
}): StaircaseCandidate | null {
  const count = staircaseSegmentCount(request.path, request.start);
  if (count < MINIMUM_STAIRCASE_SEGMENTS) return null;
  const candidate: StaircaseCandidate = { ...request, count };
  return isConservativeDiagonal(candidate) ? candidate : null;
}

function appendSimplifiedPoint(request: {
  readonly result: ToonMaskPoint[];
  readonly path: readonly ToonMaskPoint[];
  readonly segment: number;
  readonly candidate: StaircaseCandidate | null;
}): void {
  const endpoint = request.candidate
    ? request.path[request.segment + request.candidate.count]
    : request.path[request.segment + 1];
  if (endpoint) request.result.push(endpoint);
}

function staircaseSegmentCount(
  path: readonly ToonMaskPoint[],
  start: number,
): number {
  const first = cardinalDirection(path[start], path[start + 1]);
  const second = cardinalDirection(path[start + 1], path[start + 2]);
  if (first === null || second === null || first % 2 === second % 2) return 0;
  let count = 2;
  while (start + count < path.length) {
    const direction = cardinalDirection(
      path[start + count],
      path[start + count + 1],
    );
    if (direction !== expectedStairDirection(first, second, count)) break;
    count += 1;
  }
  return count - count % 2;
}

function expectedStairDirection(
  first: number,
  second: number,
  count: number,
): number {
  return count % 2 === 0 ? first : second;
}

function cardinalDirection(
  from: ToonMaskPoint | undefined,
  to: ToonMaskPoint | undefined,
): number | null {
  if (!from || !to) return null;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return null;
  if (dx > 0) return 0;
  if (dy > 0) return 1;
  if (dx < 0) return 2;
  return 3;
}

function rotatePath(
  path: readonly ToonMaskPoint[],
  start: number,
): ToonMaskPoint[] {
  return [...path.slice(start), ...path.slice(0, start)];
}
