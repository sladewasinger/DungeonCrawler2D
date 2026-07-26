import { highEndAtStart, TREAD_COUNT } from "./stairTread.js";
import {
  buildSteppedStairSurface,
  edgeRange,
  FULL,
  sampleStairBands,
  type StairBandProfile,
} from "./steppedStairGeometry.js";
import type { SteppedStairSurface } from "./steppedStairSurface.js";

function horizontalBandProfile(): StairBandProfile[] {
  return Array.from({ length: TREAD_COUNT }, (_, index) => ({
    start: index / TREAD_COUNT,
    end: (index + 1) / TREAD_COUNT,
    sample: (index + 0.5) / TREAD_COUNT,
  }));
}

export function horizontalStairSurface(
  wx: number,
  wy: number,
  direction: number,
  groundAt: (x: number, y: number) => number,
): SteppedStairSurface {
  const highAtStart = highEndAtStart(direction);
  const bands = sampleStairBands(
    horizontalBandProfile(),
    (sample) => [wx + sample, wy + 0.5],
    groundAt,
  );
  return buildSteppedStairSurface("x", highAtStart, bands, (band) => ({
    fillX: [band.start, band.end],
    fillY: FULL,
    highlightX: edgeRange(band.start, band.end, highAtStart),
    highlightY: FULL,
  }));
}
