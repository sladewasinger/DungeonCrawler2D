import type Phaser from "phaser";
import { heightTint, multiplyTint, topEdgeHighlightTint } from "./heightShade.js";
import { placeFractionalRect, surfaceLiftPx } from "./placeSprite.js";
import { TREAD_COUNT } from "./stairTread.js";
import type { ViewTerrainWorld } from "./viewWorld.js";

const EDGE_THICKNESS = 0.045;

export interface SideStairBand {
  start: number;
  end: number;
  sample: number;
}

export const sideStairBands = (): SideStairBand[] =>
  Array.from({ length: TREAD_COUNT }, (_, index) => ({
    start: index / TREAD_COUNT,
    end: (index + 1) / TREAD_COUNT,
    sample: (index + 0.5) / TREAD_COUNT,
  }));

export function drawSideStair(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  world: ViewTerrainWorld,
  wx: number,
  wy: number,
  lightTint: number,
): void {
  for (const band of sideStairBands()) {
    const height = world.groundAt(wx + band.sample, wy + 0.5);
    const lift = surfaceLiftPx(height);
    const fill = multiplyTint(heightTint(height), lightTint);
    const edge = multiplyTint(topEdgeHighlightTint(height), lightTint);
    placeFractionalRect(scene, container, wx, wy, [band.start, band.end], [0, 1], fill, 1, lift);
    placeFractionalRect(
      scene,
      container,
      wx,
      wy,
      [band.start, band.end],
      [0, EDGE_THICKNESS],
      edge,
      0.9,
      lift,
    );
  }
}
