import type Phaser from "phaser";
import { heightTint, multiplyTint, topEdgeHighlightTint } from "./heightShade.js";
import { placeFractionalRect, surfaceLiftBakePx } from "./placeSprite.js";
import { highEndAtStart, stacksVertically, TREAD_COUNT } from "./stairTread.js";
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

const stairBandProfile = (): StairBandProfile[] =>
  Array.from({ length: TREAD_COUNT }, (_, index) => ({
    start: index / TREAD_COUNT,
    end: (index + 1) / TREAD_COUNT,
    sample: (index + 0.5) / TREAD_COUNT,
  }));

function edgeRange(start: number, end: number, highAtStart: boolean): readonly [number, number] {
  return highAtStart
    ? [start, Math.min(end, start + EDGE_THICKNESS)]
    : [Math.max(start, end - EDGE_THICKNESS), end];
}

export function steppedStairSurface(
  wx: number,
  wy: number,
  direction: number,
  groundAt: (x: number, y: number) => number,
): SteppedStairSurface {
  const axis: StairSurfaceAxis = stacksVertically(direction) ? "y" : "x";
  const highAtStart = highEndAtStart(direction);
  const bands = stairBandProfile().map((band): StairSurfaceBand => {
    const sampleX = axis === "x" ? wx + band.sample : wx + 0.5;
    const sampleY = axis === "y" ? wy + band.sample : wy + 0.5;
    const height = groundAt(sampleX, sampleY);
    const edge = edgeRange(band.start, band.end, highAtStart);
    return {
      ...band,
      sampleX,
      sampleY,
      height,
      liftBakePx: surfaceLiftBakePx(height),
      fillX: axis === "x" ? [band.start, band.end] : FULL,
      fillY: axis === "y" ? [band.start, band.end] : FULL,
      highlightX: axis === "x" ? edge : FULL,
      highlightY: axis === "y" ? edge : FULL,
    };
  });
  return { axis, highAtStart, bands };
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
  for (const band of steppedStairSurface(wx, wy, direction, (x, y) => world.groundAt(x, y)).bands) {
    const fill = multiplyTint(heightTint(band.height), lightTint);
    const edge = multiplyTint(topEdgeHighlightTint(band.height), lightTint);
    placeFractionalRect(
      scene,
      container,
      wx,
      wy,
      band.fillX,
      band.fillY,
      fill,
      1,
      band.liftBakePx,
    );
    placeFractionalRect(
      scene,
      container,
      wx,
      wy,
      band.highlightX,
      band.highlightY,
      edge,
      0.9,
      band.liftBakePx,
    );
  }
}
