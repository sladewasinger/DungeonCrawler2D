import { hash2D } from "../../../../core/rng.js";
import { carveAt, insideBounds, isCarved, localIndex } from "../../finiteFloorBuffers.js";
import { FLOOR_SEMANTIC, type FloorBounds, type FloorBuffers, type FloorPoint, type GeneratedConnector } from "../../finiteFloorTypes.js";
import {
  barrierLines, barrierRuns, pointOnBarrierLine,
  segmentLongBarriers, type BarrierAxis, type BarrierLine, type BarrierRun,
} from "./finiteMazeBarrierSegmentation.js";

interface MazeCrossingInput {
  readonly buffers: FloorBuffers;
  readonly bounds: FloorBounds;
  readonly seed: number;
  readonly width: number;
}

interface BarrierCandidate extends FloorPoint {
  readonly axis: BarrierAxis;
  readonly regionIds: readonly [number, number];
}

export interface MazeCrossingResult {
  readonly connectors: readonly GeneratedConnector[];
  readonly regionLinks: readonly (readonly [number, number])[];
}

export { deterministicBarrierOpeningOffsets } from "./finiteMazeBarrierSegmentation.js";

export function admitMazeCrossings(input: MazeCrossingInput): MazeCrossingResult {
  const candidates = [
    ...barrierCandidates(input, "horizontal"),
    ...barrierCandidates(input, "vertical"),
  ];
  const selected = candidates.toSorted((left, right) => crossingOrder(input.seed, left, right));
  const connectors: GeneratedConnector[] = [];
  const regionLinks: (readonly [number, number])[] = [];
  const occupied = new Set<string>();
  for (const candidate of selected) {
    const connector = admitCandidate(input, candidate, occupied);
    if (!connector) continue;
    connectors.push(connector);
    regionLinks.push(regionLinkFor(connector));
  }
  const segmented = segmentLongBarriers({
    lines: [
      ...barrierLines(input.bounds, "horizontal"),
      ...barrierLines(input.bounds, "vertical"),
    ],
    width: input.width,
    runs: (line) => barrierRuns({
      line, minimumLength: minimumBarrierLength(input),
      allowed: (point) => crossingCellAllowed(input, point),
    }),
    pointAt: pointOnBarrierLine,
    regionsAt: (axis, point) => adjacentRegions(input, axis, point),
    canOpen: (axis, point) => apertureAvailable(input, { ...point, axis }, occupied),
    open: (axis, point, regions) => openAperture(input, { ...point, axis, regionIds: regions }, occupied),
  });
  connectors.push(...segmented.connectors);
  regionLinks.push(...segmented.regionLinks);
  return { connectors, regionLinks };
}

function regionLinkFor(connector: GeneratedConnector): readonly [number, number] {
  const [first, second] = connector.regionIds;
  if (first === undefined || second === undefined || connector.regionIds.length !== 2) {
    throw new Error("Maze crossing connector must join exactly two regions");
  }
  return [first, second];
}

function admitCandidate(input: MazeCrossingInput, candidate: BarrierCandidate, occupied: Set<string>): GeneratedConnector | null {
  const key = `${candidate.x},${candidate.y}`;
  if (occupied.has(key) || !openCrossing(input, candidate)) return null;
  occupied.add(key);
  return { x: candidate.x, y: candidate.y, regionIds: candidate.regionIds, loop: false, protected: true, pathSaving: 0 };
}

function barrierCandidates(input: MazeCrossingInput, axis: BarrierCandidate["axis"]): BarrierCandidate[] {
  return barrierLines(input.bounds, axis).flatMap((line) => barrierRuns({
    line,
    minimumLength: minimumBarrierLength(input),
    allowed: (point) => crossingCellAllowed(input, point),
  })
    .map((run) => crossingInRun({ input, line, run }))
    .filter((candidate): candidate is BarrierCandidate => candidate !== null));
}

function crossingInRun(input: { readonly input: MazeCrossingInput; readonly line: BarrierLine; readonly run: BarrierRun }): BarrierCandidate | null {
  const points: BarrierCandidate[] = [];
  for (let inner = input.run.start; inner <= input.run.end; inner++) {
    const point = pointOnBarrierLine(input.line, inner);
    const regions = crossingRegions(input.input, input.line.axis, point);
    if (regions) points.push({ ...point, axis: input.line.axis, regionIds: regions });
  }
  return points.toSorted((left, right) => crossingOrder(input.input.seed, left, right))[0] ?? null;
}

function adjacentRegions(input: MazeCrossingInput, axis: BarrierCandidate["axis"], point: FloorPoint): readonly [number, number] | null {
  const direction = axis === "horizontal" ? { x: 0, y: 1 } : { x: 1, y: 0 };
  const firstRegion = carvedRegion(input, { x: point.x - direction.x, y: point.y - direction.y });
  const secondRegion = carvedRegion(input, { x: point.x + direction.x, y: point.y + direction.y });
  return firstRegion > 0 && secondRegion > 0 ? [firstRegion, secondRegion] : null;
}

function minimumBarrierLength(input: MazeCrossingInput): number { return Math.max(8, input.width * 4); }

function crossingRegions(input: MazeCrossingInput, axis: BarrierCandidate["axis"], point: FloorPoint): readonly [number, number] | null {
  const regions = adjacentRegions(input, axis, point);
  return regions && regions[0] !== regions[1] ? regions : null;
}

function openCrossing(input: MazeCrossingInput, candidate: BarrierCandidate): boolean {
  if (!apertureAvailable(input, candidate)) return false;
  openAperture(input, candidate);
  return true;
}

function apertureAvailable(
  input: MazeCrossingInput,
  candidate: Pick<BarrierCandidate, "x" | "y" | "axis">,
  occupied?: Set<string>,
): boolean {
  if (occupied?.has(`${candidate.x},${candidate.y}`)) return false;
  return crossingAperture(input, candidate).every((point) => crossingCellAllowed(input, point));
}

function openAperture(input: MazeCrossingInput, candidate: Pick<BarrierCandidate, "x" | "y" | "axis" | "regionIds">, occupied?: Set<string>): void {
  occupied?.add(`${candidate.x},${candidate.y}`);
  const regionId = candidate.regionIds[0];
  if (regionId === undefined) return;
  for (const point of crossingAperture(input, candidate)) {
    const index = localIndex({ bounds: input.bounds, ...point });
    carveAt({ buffers: input.buffers, bounds: input.bounds, point, semantic: FLOOR_SEMANTIC.Transition, regionId });
    input.buffers.protectedCells[index] = 1;
  }
}

function crossingAperture(input: MazeCrossingInput, candidate: Pick<BarrierCandidate, "x" | "y" | "axis">): FloorPoint[] {
  const width = Math.min(2, Math.max(1, Math.floor(input.width)));
  const points: FloorPoint[] = [];
  for (let offset = 0; offset < width; offset++) {
    points.push(candidate.axis === "horizontal"
      ? { x: candidate.x + offset, y: candidate.y }
      : { x: candidate.x, y: candidate.y + offset });
  }
  return points;
}

function crossingCellAllowed(input: MazeCrossingInput, point: FloorPoint): boolean {
  if (!insideBounds({ bounds: input.bounds, ...point })) return false;
  const index = localIndex({ bounds: input.bounds, ...point });
  return !isCarved(input.buffers, index)
    && (input.buffers.roomWallIds[index] ?? -1) < 0
    && (input.buffers.protectedCells[index] ?? 0) === 0;
}

function carvedRegion(input: MazeCrossingInput, point: FloorPoint): number {
  if (!insideBounds({ bounds: input.bounds, ...point })) return 0;
  const index = localIndex({ bounds: input.bounds, ...point });
  return isCarved(input.buffers, index) ? input.buffers.region[index] ?? 0 : 0;
}

function crossingOrder(seed: number, left: FloorPoint, right: FloorPoint): number {
  return hash2D(seed, left.x, left.y) - hash2D(seed, right.x, right.y)
    || left.y - right.y || left.x - right.x;
}
