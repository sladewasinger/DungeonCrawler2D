import type Phaser from "phaser";
import { heightTint, multiplyTint, topEdgeHighlightTint } from "./heightShade.js";
import { placeFractionalRect, surfaceLiftBakePx } from "./placeSprite.js";
import {
  highEndAtStart,
  stacksVertically,
  TREAD_COUNT,
  treadRisers,
} from "./stairTread.js";
import type { ViewTerrainWorld } from "./viewWorld.js";

const EDGE_THICKNESS = 0.045;
const FULL: readonly [number, number] = [0, 1];

export type StairSurfaceAxis = "x" | "y";

export interface StairSurfaceBand {
  readonly start: number;
  readonly end: number;
  readonly sample: number;
  readonly sampleX: number;
  readonly sampleY: number;
  readonly height: number;
  readonly liftBakePx: number;
  readonly fillX: readonly [number, number];
  readonly fillY: readonly [number, number];
  readonly highlightX: readonly [number, number];
  readonly highlightY: readonly [number, number];
}

export interface SteppedStairSurface {
  readonly axis: StairSurfaceAxis;
  readonly highAtStart: boolean;
  readonly bands: readonly StairSurfaceBand[];
}

interface StairBandProfile {
  readonly start: number;
  readonly end: number;
  readonly sample: number;
}

interface SampledStairBand extends StairBandProfile {
  readonly sampleX: number;
  readonly sampleY: number;
  readonly height: number;
}

const stairBandProfile = (direction: number): StairBandProfile[] => {
  if (!stacksVertically(direction)) {
    return Array.from({ length: TREAD_COUNT }, (_, index) => ({
      start: index / TREAD_COUNT,
      end: (index + 1) / TREAD_COUNT,
      sample: (index + 0.5) / TREAD_COUNT,
    }));
  }
  const boundaries = [
    0,
    ...treadRisers(direction, 0).map(({ axisFrac }) => axisFrac),
    1,
  ].filter((value, index, values) => index === 0 || value !== values[index - 1]);
  return boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1] ?? 1;
    return { start, end, sample: (start + end) / 2 };
  });
};

function edgeRange(start: number, end: number, highAtStart: boolean): readonly [number, number] {
  return highAtStart
    ? [start, Math.min(end, start + EDGE_THICKNESS)]
    : [Math.max(start, end - EDGE_THICKNESS), end];
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

export function steppedStairSurface(
  wx: number,
  wy: number,
  direction: number,
  groundAt: (x: number, y: number) => number,
): SteppedStairSurface {
  const axis: StairSurfaceAxis = stacksVertically(direction) ? "y" : "x";
  const highAtStart = highEndAtStart(direction);
  const sampledBands = stairBandProfile(direction).map((band) => {
    const sampleX = axis === "x" ? wx + band.sample : wx + 0.5;
    const sampleY = axis === "y" ? wy + band.sample : wy + 0.5;
    const height = groundAt(sampleX, sampleY);
    return { ...band, sampleX, sampleY, height };
  });
  const startHeight = axis === "y" ? groundAt(wx + 0.5, wy) : 0;
  const endHeight = axis === "y" ? groundAt(wx + 0.5, wy + 1) : 0;
  const bands = sampledBands.map((band, index): StairSurfaceBand => {
    const edge = edgeRange(band.start, band.end, highAtStart);
    return {
      ...band,
      liftBakePx: surfaceLiftBakePx(band.height),
      fillX: axis === "x" ? [band.start, band.end] : FULL,
      fillY: axis === "y"
        ? coveredVerticalFill(band, index, sampledBands, startHeight, endHeight)
        : FULL,
      highlightX: axis === "x" ? edge : FULL,
      highlightY: axis === "y" ? edge : FULL,
    };
  });
  return { axis, highAtStart, bands };
}

function drawStairBand(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  wx: number,
  wy: number,
  band: StairSurfaceBand,
  fill: number,
  edge: number,
): void {
  placeFractionalRect(scene, container, wx, wy, band.fillX, band.fillY, fill, 1, band.liftBakePx);
  placeFractionalRect(scene, container, wx, wy, band.highlightX, band.highlightY, edge, 0.9, band.liftBakePx);
}

export function drawSteppedStairSurface(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  world: ViewTerrainWorld,
  wx: number,
  wy: number,
  direction: number,
  lightTint: number,
): void {
  let i = 0;
  for (const band of steppedStairSurface(wx, wy, direction, (x, y) => world.groundAt(x, y)).bands) {
    i += 2;
    const fill = multiplyTint(heightTint(band.height), lightTint);
    console.log(`drawSteppedStairSurface: band ${i} at (${wx}, ${wy}) with height ${band.height} and fill ${fill.toString(16)}`);
    let edge = multiplyTint(topEdgeHighlightTint(band.height), lightTint);
    // change color of edge based on height for debugging (multipled by i to make it darker for lower bands):
    // convert i to a hex string and pad with zeros to ensure it's 2 characters long
    // make middle edge green for debugging:
    if (i == 0.5) {
      edge = multiplyTint(0x00ff00, lightTint);
    }

    drawStairBand(scene, container, wx, wy, band, fill, edge);
  }
}
