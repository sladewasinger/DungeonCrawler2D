import { TILE } from "@dc2d/engine";
import type Phaser from "phaser";
import { DEBUG_TILE_PX, DEBUG_WALL_BORDER_PX } from "./debugTileset.js";
import { drawVerticalStairSideShade } from "./drawContactShade.js";
import { hasWallMaterialAtScreen } from "./drawWallTile.js";
import { heightTint, multiplyTint, topEdgeHighlightTint } from "./heightShade.js";
import { horizontalStairSurface } from "./horizontalStairSurface.js";
import { placeFractionalRect } from "./placeSprite.js";
import { stacksVertically } from "./stairTread.js";
import { renderedSurfaceHeight } from "./stairSurface.js";
import type { StairBandFace } from "./steppedStairGeometry.js";
import type { ViewTerrainWorld } from "./viewWorld.js";
import { verticalStairSurface } from "./verticalStairSurface.js";

export type {
  SampledStairBand,
  StairBandProfile,
  StairBandRanges,
} from "./steppedStairGeometry.js";

export type StairSurfaceAxis = "x" | "y";

const STAIR_SIDE_EDGE_THICKNESS = 0.12;
const PROJECTED_WALL_EDGE_THICKNESS = DEBUG_WALL_BORDER_PX / DEBUG_TILE_PX;
const PROJECTED_WALL_EDGE_COLOR = 0x000000;

export interface StairSurfaceBand {
  readonly start: number;
  readonly end: number;
  readonly sample: number;
  readonly sampleX: number;
  readonly sampleY: number;
  readonly height: number;
  readonly liftBakePx: number;
  readonly floor?: StairBandFace;
  readonly tread: StairBandFace;
  readonly riser?: StairBandFace;
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

function drawStairFace(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  wx: number,
  wy: number,
  band: StairSurfaceBand,
  face: StairBandFace,
  tint: number,
): void {
  placeFractionalRect(scene, container, wx, wy, face.x, face.y, tint, 1, band.liftBakePx);
}

function sideEdgeRange(side: "west" | "east", width: number): readonly [number, number] {
  return side === "west" ? [-width, 0] : [1, 1 + width];
}

function drawVerticalStairSideOutline(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  world: ViewTerrainWorld,
  wx: number,
  wy: number,
  band: StairSurfaceBand,
  face: StairBandFace,
  side: "west" | "east",
  outlineTint: number,
): void {
  const dx = side === "west" ? -1 : 1;
  const screenY = Math.floor(wy + (face.y[0] + face.y[1]) / 2 - band.height);
  const rawY = Math.floor(band.sampleY);
  const topDownWall = world.tileAt(wx + dx, rawY) === TILE.Wall;
  const enclosesStair = world.heightAt(wx + dx, rawY) >= band.height + 0.1;
  const wall = topDownWall || (enclosesStair && hasWallMaterialAtScreen(world, wx + dx, screenY));
  const floor = world.tileAt(wx + dx, screenY) === TILE.Floor;
  if (wall) {
    placeFractionalRect(scene, container, wx, wy, sideEdgeRange(side, PROJECTED_WALL_EDGE_THICKNESS), face.y, PROJECTED_WALL_EDGE_COLOR, 1, band.liftBakePx);
  } else if (floor) {
    placeFractionalRect(scene, container, wx, wy, sideEdgeRange(side, STAIR_SIDE_EDGE_THICKNESS), face.y, outlineTint, 1, band.liftBakePx);
  }
}

function drawVerticalStairSideOutlineFaces(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  world: ViewTerrainWorld,
  wx: number,
  wy: number,
  bands: readonly StairSurfaceBand[],
  outlineTint: number,
): void {
  for (const band of bands) {
    for (const face of [band.tread, ...(band.riser ? [band.riser] : [])]) {
      drawVerticalStairSideOutline(scene, container, world, wx, wy, band, face, "west", outlineTint);
      drawVerticalStairSideOutline(scene, container, world, wx, wy, band, face, "east", outlineTint);
    }
  }
}

/** Draws vertical stair side outlines in the caller's chosen depth layer. */
export function drawVerticalStairSideOutlines(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  world: ViewTerrainWorld,
  wx: number,
  wy: number,
  direction: number,
  lightTint: number,
): void {
  const surface = steppedStairSurface(wx, wy, direction, (x, y) => world.groundAt(x, y));
  if (surface.axis !== "y") return;
  const height = renderedSurfaceHeight(TILE.Stairs, world.groundAt(wx + 0.5, wy + 0.5));
  const outlineTint = multiplyTint(topEdgeHighlightTint(height), lightTint);
  drawVerticalStairSideOutlineFaces(scene, container, world, wx, wy, surface.bands, outlineTint);
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
  const surface = steppedStairSurface(wx, wy, direction, (x, y) => world.groundAt(x, y));
  const { bands } = surface;
  for (const band of bands) {
    if (band.floor) drawStairFace(scene, container, wx, wy, band, band.floor, multiplyTint(heightTint(band.height), lightTint));
  }
  for (const band of bands) {
    if (band.riser) drawStairFace(scene, container, wx, wy, band, band.riser, multiplyTint(heightTint(band.height), multiplyTint(lightTint, 0x555555)));
  }
  for (const band of bands) {
    drawStairFace(scene, container, wx, wy, band, band.tread, multiplyTint(topEdgeHighlightTint(band.height), lightTint));
  }
  if (surface.axis === "y") drawVerticalStairSideShade(scene, container, world, wx, wy, verticalStairShadeFaces(bands));
}

function verticalStairShadeFaces(bands: readonly StairSurfaceBand[]) {
  return bands.flatMap((band) => [
    { y: band.tread.y, liftPx: band.liftBakePx, sampleY: band.sampleY, height: band.height },
    ...(band.riser ? [{ y: band.riser.y, liftPx: band.liftBakePx, sampleY: band.sampleY, height: band.height }] : []),
  ]);
}
