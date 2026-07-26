import { surfaceLiftBakePx } from "./placeSprite.js";
import type { StairSurfaceAxis, SteppedStairSurface } from "./steppedStairSurface.js";

export interface StairBandProfile {
  readonly start: number;
  readonly end: number;
  readonly sample: number;
}

export interface SampledStairBand extends StairBandProfile {
  readonly sampleX: number;
  readonly sampleY: number;
  readonly height: number;
}

export interface StairBandFace {
  readonly x: readonly [number, number];
  readonly y: readonly [number, number];
}

export interface StairBandRanges {
  /** Flat floor fill used by horizontal stairs. */
  readonly floor?: StairBandFace;
  /** Bright horizontal tread face. */
  readonly tread: StairBandFace;
  /** Dark vertical face that rises toward the ceiling. */
  readonly riser?: StairBandFace;
}

export const FULL: readonly [number, number] = [0, 1];

export function edgeRange(
  start: number,
  end: number,
  highAtStart: boolean,
): readonly [number, number] {
  const edgeThickness = 0.045;
  if (highAtStart) return [start, Math.min(end, start + edgeThickness)];
  return [Math.max(start, end - edgeThickness), end];
}

export function sampleStairBands(
  profile: readonly StairBandProfile[],
  samplePosition: (sample: number) => readonly [number, number],
  groundAt: (x: number, y: number) => number,
): SampledStairBand[] {
  return profile.map((band) => {
    const [sampleX, sampleY] = samplePosition(band.sample);
    return { ...band, sampleX, sampleY, height: groundAt(sampleX, sampleY) };
  });
}

export function buildSteppedStairSurface(
  axis: StairSurfaceAxis,
  highAtStart: boolean,
  sampledBands: readonly SampledStairBand[],
  rangesFor: (
    band: SampledStairBand,
    index: number,
    bands: readonly SampledStairBand[],
  ) => StairBandRanges,
): SteppedStairSurface {
  return {
    axis,
    highAtStart,
    bands: sampledBands.map((band, index) => ({
      ...band,
      liftBakePx: surfaceLiftBakePx(band.height),
      ...rangesFor(band, index, sampledBands),
    })),
  };
}
