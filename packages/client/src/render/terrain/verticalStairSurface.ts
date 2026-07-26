import { highEndAtStart, treadRisers } from "./stairTread.js";
import {
  buildSteppedStairSurface,
  edgeRange,
  FULL,
  sampleStairBands,
  type SampledStairBand,
  type StairBandProfile,
} from "./steppedStairGeometry.js";
import type { SteppedStairSurface } from "./steppedStairSurface.js";

function verticalBandProfile(direction: number): StairBandProfile[] {
  const boundaries = [
    0,
    ...treadRisers(direction, 0).map(({ axisFrac }) => axisFrac),
    1,
  ].filter((value, index, values) => index === 0 || value !== values[index - 1]);
  return boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1] ?? 1;
    return { start, end, sample: (start + end) / 2 };
  });
}

function coveredVerticalFill(
  band: SampledStairBand,
  index: number,
  bands: readonly SampledStairBand[],
  startHeight: number,
  endHeight: number,
): readonly [number, number] {
  const projectedStart = band.start - band.height;
  const projectedEnd = band.end - band.height;
  const coveredStart = index === 0
    ? Math.min(projectedStart, -startHeight)
    : projectedStart;
  const next = bands[index + 1];
  const coveredEnd = next
    ? Math.max(projectedEnd, next.start - next.height)
    : Math.max(projectedEnd, 1 - endHeight);
  const fillStart = coveredStart < projectedStart
    ? coveredStart + band.height
    : band.start;
  const fillEnd = coveredEnd > projectedEnd
    ? coveredEnd + band.height
    : band.end;
  return [fillStart, fillEnd];
}

export function verticalStairSurface(
  wx: number,
  wy: number,
  direction: number,
  groundAt: (x: number, y: number) => number,
): SteppedStairSurface {
  const highAtStart = highEndAtStart(direction);
  const bands = sampleStairBands(
    verticalBandProfile(direction),
    (sample) => [wx + 0.5, wy + sample],
    groundAt,
  );
  const startHeight = groundAt(wx + 0.5, wy);
  const endHeight = groundAt(wx + 0.5, wy + 1);
  return buildSteppedStairSurface("y", highAtStart, bands, (band, index, allBands) => ({
    fillX: FULL,
    fillY: coveredVerticalFill(band, index, allBands, startHeight, endHeight),
    highlightX: FULL,
    highlightY: edgeRange(band.start, band.end, highAtStart),
  }));
}
