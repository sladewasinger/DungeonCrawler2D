import type { FloorBounds, FloorPoint, GeneratedConnector } from "../../finiteFloorTypes.js";

export type BarrierAxis = "horizontal" | "vertical";
export interface BarrierLine { readonly axis: BarrierAxis; readonly outer: number; readonly start: number; readonly limit: number; }
export interface BarrierRun { readonly start: number; readonly end: number; }

export function barrierLines(bounds: FloorBounds, axis: BarrierAxis): BarrierLine[] {
  const outerStart = axis === "horizontal" ? bounds.minY + 1 : bounds.minX + 1;
  const limit = axis === "horizontal" ? bounds.maxY : bounds.maxX;
  const start = axis === "horizontal" ? bounds.minX + 1 : bounds.minY + 1;
  return Array.from({ length: Math.max(0, limit - outerStart) }, (_, offset) => ({
    axis, outer: outerStart + offset, start,
    limit: axis === "horizontal" ? bounds.maxX : bounds.maxY,
  }));
}

export function pointOnBarrierLine(line: BarrierLine, inner: number): FloorPoint {
  return line.axis === "horizontal" ? { x: inner, y: line.outer } : { x: line.outer, y: inner };
}

export function barrierRuns(input: {
  readonly line: BarrierLine;
  readonly minimumLength: number;
  readonly allowed: (point: FloorPoint) => boolean;
}): BarrierRun[] {
  const runs: BarrierRun[] = [];
  let start: number | null = null;
  for (let inner = input.line.start; inner < input.line.limit; inner++) {
    const allowed = input.allowed(pointOnBarrierLine(input.line, inner));
    if (allowed) start = start ?? inner;
    else if (start !== null) {
      appendBarrierRun({ runs, start, end: inner - 1, minimumLength: input.minimumLength });
      start = null;
    }
  }
  if (start !== null) appendBarrierRun({ runs, start, end: input.line.limit - 1, minimumLength: input.minimumLength });
  return runs;
}

function appendBarrierRun(input: {
  readonly runs: BarrierRun[];
  readonly start: number;
  readonly end: number;
  readonly minimumLength: number;
}): void {
  if (input.end - input.start + 1 >= input.minimumLength) {
    input.runs.push({ start: input.start, end: input.end });
  }
}

export function deterministicBarrierOpeningOffsets(input: {
  readonly start: number;
  readonly end: number;
  readonly width: number;
}): readonly number[] {
  const spacing = Math.max(8, Math.floor(input.width) * 4) * 2;
  const apertureWidth = Math.min(2, Math.max(1, Math.floor(input.width)));
  const offsets: number[] = [];
  for (let offset = input.start + spacing; offset + apertureWidth - 1 <= input.end; offset += spacing) offsets.push(offset);
  return offsets;
}

export interface BarrierSegmentationInput {
  readonly lines: readonly BarrierLine[];
  readonly width: number;
  readonly runs: (line: BarrierLine) => readonly BarrierRun[];
  readonly pointAt: (line: BarrierLine, inner: number) => FloorPoint;
  readonly regionsAt: (axis: BarrierAxis, point: FloorPoint) => readonly [number, number] | null;
  readonly canOpen: (axis: BarrierAxis, point: FloorPoint) => boolean;
  readonly open: (axis: BarrierAxis, point: FloorPoint, regions: readonly [number, number]) => void;
}

export function segmentLongBarriers(input: BarrierSegmentationInput): {
  readonly connectors: readonly GeneratedConnector[];
  readonly regionLinks: readonly (readonly [number, number])[];
} {
  const openings = input.lines.flatMap((line) => input.runs(line).flatMap((run) =>
    segmentRun({ ...input, line, run })));
  const connectors = openings.flatMap((opening) => opening.regions[0] === opening.regions[1]
    ? [] : [connectorForOpening(opening)]);
  return { connectors, regionLinks: connectors.map(regionLinkForOpening) };
}

function segmentRun(input: BarrierSegmentationInput & { readonly line: BarrierLine; readonly run: BarrierRun }): Array<{ readonly point: FloorPoint; readonly axis: BarrierAxis; readonly regions: readonly [number, number] }> {
  return deterministicBarrierOpeningOffsets({ start: input.run.start, end: input.run.end, width: input.width }).flatMap((inner) => {
    const point = input.pointAt(input.line, inner);
    const regions = input.regionsAt(input.line.axis, point);
    if (!regions || !input.canOpen(input.line.axis, point)) return [];
    input.open(input.line.axis, point, regions);
    return [{ point, axis: input.line.axis, regions }];
  });
}

function connectorForOpening(input: { readonly point: FloorPoint; readonly regions: readonly [number, number] }): GeneratedConnector {
  return { x: input.point.x, y: input.point.y, regionIds: input.regions, loop: false, protected: true, pathSaving: 0 };
}

function regionLinkForOpening(connector: GeneratedConnector): readonly [number, number] {
  const first = connector.regionIds[0];
  const second = connector.regionIds[1];
  if (first === undefined || second === undefined) throw new Error("Barrier opening must join two regions");
  return [first, second];
}
