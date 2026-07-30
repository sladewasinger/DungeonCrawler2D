import {
  cellKey,
  cross,
  pathEdge,
  samePoint,
  type BoundaryEdge,
  type MaskOccupancy,
  type ToonMaskPoint,
} from "./contourTypes.js";

const INTERIOR_SAMPLE_OFFSET = 0.2;

export interface StaircaseCandidate {
  readonly path: readonly ToonMaskPoint[];
  readonly start: number;
  readonly count: number;
  readonly occupancy: MaskOccupancy;
}

export function isConservativeDiagonal(
  candidate: StaircaseCandidate,
): boolean {
  return replacesAreaInward(candidate) &&
    chordAvoidsOtherBoundary(candidate) &&
    hasContinuousInterior(candidate);
}

function replacesAreaInward(candidate: StaircaseCandidate): boolean {
  let staircaseArea = 0;
  for (let index = 0; index < candidate.count; index += 1) {
    staircaseArea += cross(
      candidate.path[candidate.start + index] as ToonMaskPoint,
      candidate.path[candidate.start + index + 1] as ToonMaskPoint,
    );
  }
  const { from, to } = candidateEndpoints(candidate);
  return cross(from, to) < staircaseArea;
}

function chordAvoidsOtherBoundary(candidate: StaircaseCandidate): boolean {
  const chord = candidateEndpoints(candidate);
  for (let index = 0; index < candidate.path.length; index += 1) {
    if (isReplacedSegment(index, candidate)) continue;
    const edge = pathEdge(candidate.path, index);
    if (sharesOnlyChordEndpoint(chord, edge)) continue;
    if (segmentsIntersect(chord, edge)) return false;
  }
  return true;
}

function hasContinuousInterior(candidate: StaircaseCandidate): boolean {
  const { from, to } = candidateEndpoints(candidate);
  const steps = Math.abs(to.x - from.x);
  if (steps !== Math.abs(to.y - from.y) || steps === 0) return false;
  const direction = { x: Math.sign(to.x - from.x), y: Math.sign(to.y - from.y) };
  return interiorElevation({ from, direction, steps, occupancy: candidate.occupancy }) !== null;
}

function interiorElevation(request: {
  readonly from: ToonMaskPoint;
  readonly direction: ToonMaskPoint;
  readonly steps: number;
  readonly occupancy: MaskOccupancy;
}): number | null {
  let elevation: number | null = null;
  for (let step = 0; step < request.steps; step += 1) {
    const sample = interiorSample(request, step);
    const current = request.occupancy.elevations.get(cellKey(
      Math.floor(sample.x), Math.floor(sample.y),
    ));
    if (current === undefined || current === null) return null;
    if (elevation !== null && elevation !== current) return null;
    elevation = current;
  }
  return elevation;
}

function interiorSample(
  request: Pick<Parameters<typeof interiorElevation>[0], "from" | "direction">,
  step: number,
): ToonMaskPoint {
  return {
    x: request.from.x + request.direction.x * (step + 0.5) -
      request.direction.y * INTERIOR_SAMPLE_OFFSET,
    y: request.from.y + request.direction.y * (step + 0.5) +
      request.direction.x * INTERIOR_SAMPLE_OFFSET,
  };
}

function candidateEndpoints(candidate: StaircaseCandidate): BoundaryEdge {
  return {
    from: candidate.path[candidate.start] as ToonMaskPoint,
    to: candidate.path[candidate.start + candidate.count] as ToonMaskPoint,
  };
}

function isReplacedSegment(index: number, candidate: StaircaseCandidate): boolean {
  return index >= candidate.start && index < candidate.start + candidate.count;
}

function sharesOnlyChordEndpoint(
  chord: BoundaryEdge,
  edge: BoundaryEdge,
): boolean {
  const shared = samePoint(chord.from, edge.from) ||
    samePoint(chord.from, edge.to) ||
    samePoint(chord.to, edge.from) ||
    samePoint(chord.to, edge.to);
  return shared && !segmentsProperlyIntersect(chord, edge);
}

function segmentsIntersect(left: BoundaryEdge, right: BoundaryEdge): boolean {
  const first = orientation(left.from, left.to, right.from);
  const second = orientation(left.from, left.to, right.to);
  const third = orientation(right.from, right.to, left.from);
  const fourth = orientation(right.from, right.to, left.to);
  return first * second <= 0 && third * fourth <= 0;
}

function segmentsProperlyIntersect(
  left: BoundaryEdge,
  right: BoundaryEdge,
): boolean {
  const first = orientation(left.from, left.to, right.from);
  const second = orientation(left.from, left.to, right.to);
  const third = orientation(right.from, right.to, left.from);
  const fourth = orientation(right.from, right.to, left.to);
  return first * second < 0 && third * fourth < 0;
}

function orientation(
  first: ToonMaskPoint,
  second: ToonMaskPoint,
  third: ToonMaskPoint,
): number {
  return Math.sign(cross(
    { x: second.x - first.x, y: second.y - first.y },
    { x: third.x - first.x, y: third.y - first.y },
  ));
}
