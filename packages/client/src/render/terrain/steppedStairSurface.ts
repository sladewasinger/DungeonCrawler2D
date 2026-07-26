import type Phaser from "phaser";
import { heightTint, multiplyTint, topEdgeHighlightTint } from "./heightShade.js";
import { horizontalStairSurface } from "./horizontalStairSurface.js";
import { placeFractionalRect } from "./placeSprite.js";
import { stacksVertically } from "./stairTread.js";
import type { ViewTerrainWorld } from "./viewWorld.js";
import { verticalStairSurface } from "./verticalStairSurface.js";

export type {
  SampledStairBand,
  StairBandProfile,
  StairBandRanges,
} from "./steppedStairGeometry.js";

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

export function steppedStairSurface(
  wx: number,
  wy: number,
  direction: number,
  groundAt: (x: number, y: number) => number,
): SteppedStairSurface {
  if (stacksVertically(direction)) {
    return verticalStairSurface(wx, wy, direction, groundAt);
  }
  return horizontalStairSurface(wx, wy, direction, groundAt);
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
  for (const band of steppedStairSurface(wx, wy, direction, (x, y) => world.groundAt(x, y)).bands) {
    const fill = multiplyTint(heightTint(band.height), lightTint);
    const edge = multiplyTint(topEdgeHighlightTint(band.height), lightTint);
    drawStairBand(scene, container, wx, wy, band, fill, edge);
  }
}
