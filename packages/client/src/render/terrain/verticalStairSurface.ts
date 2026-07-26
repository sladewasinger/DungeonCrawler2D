import { highEndAtStart, TREAD_COUNT } from "./stairTread.js";
import {
  buildSteppedStairSurface,
  FULL,
  sampleStairBands,
  type StairBandProfile,
} from "./steppedStairGeometry.js";
import type { SteppedStairSurface } from "./steppedStairSurface.js";

const RISER_SCREEN_THICKNESS = 0.25;
const RISER_FACE_SCREEN_DEPTH = 0.25;

function verticalBandProfile(): StairBandProfile[] {
  return Array.from({ length: TREAD_COUNT }, (_, index) => ({
    start: index / TREAD_COUNT,
    end: (index + 1) / TREAD_COUNT,
    sample: (index + 0.5) / TREAD_COUNT,
  }));
}

/** The screen-Y span a vertical stair owns, relative to its raw tile row. */
export function verticalStairProjectedRange(centerHeight: number): readonly [number, number] {
  const center = 0.5 - centerHeight;
  return [center - 1, center + 1];
}

function project(range: readonly [number, number], fraction: number): number {
  return range[0] + (range[1] - range[0]) * fraction;
}

export function verticalStairSurface(
  wx: number,
  wy: number,
  direction: number,
  groundAt: (x: number, y: number) => number,
): SteppedStairSurface {
  const highAtStart = highEndAtStart(direction);
  const bands = sampleStairBands(
    verticalBandProfile(),
    (sample) => [wx, wy + sample],
    groundAt,
  );
  const screenRange = verticalStairProjectedRange(groundAt(wx + 0.5, wy + 0.5));
  return buildSteppedStairSurface("y", highAtStart, bands, (band) => {
    const projectedStart = project(screenRange, band.start);
    const projectedEnd = project(screenRange, band.end);
    const highlightStart = highAtStart
      ? projectedStart
      : Math.max(projectedStart, projectedEnd - RISER_SCREEN_THICKNESS);
    const highlightEnd = highAtStart
      ? Math.min(projectedEnd, projectedStart + RISER_SCREEN_THICKNESS)
      : projectedEnd;
    const riserStart = highAtStart
      ? highlightEnd
      : Math.max(projectedStart, highlightStart - RISER_FACE_SCREEN_DEPTH);
    const riserEnd = highAtStart
      ? Math.min(projectedEnd, highlightEnd + RISER_FACE_SCREEN_DEPTH)
      : highlightStart;
    // Convert the desired projected-space coordinates back to this band's
    // tile-local coordinates. placeFractionalRect then applies its normal
    // height lift, putting every fill exactly where the profile says it goes.
    return {
      tread: {
        x: FULL,
        y: [highlightStart + band.height, highlightEnd + band.height],
      },
      riser: {
        x: FULL,
        y: [riserStart + band.height, riserEnd + band.height],
      },
    };
  });
}
