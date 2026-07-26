import type { StairVisual } from "@dc2d/engine";
import type Phaser from "phaser";
import { pickFloorFrame } from "./debugArt.js";
import { placeDebugTile } from "./debugSprite.js";
import { drawSteppedStairSurface } from "./steppedStairSurface.js";
import { screenClimbDirIndex } from "./stairScreenDirection.js";
import type { ViewTerrainWorld } from "./viewWorld.js";

export interface StairRenderState {
  screenDirection: number;
  surface: "floor" | "stepped";
}

export function stairRenderState(
  stairVisual: StairVisual | null,
  world: ViewTerrainWorld,
): StairRenderState {
  const screenDirection = stairVisual ? screenClimbDirIndex(stairVisual.direction, world.orientation) : 0;
  return {
    screenDirection,
    surface: stairVisual ? "stepped" : "floor",
  };
}

export function drawStairBase(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  world: ViewTerrainWorld,
  wx: number,
  wy: number,
  state: StairRenderState,
  tint: number,
  lightTint: number,
  liftPx: number,
): void {
  if (state.surface === "stepped") {
    drawSteppedStairSurface(scene, container, world, wx, wy, state.screenDirection, lightTint);
    return;
  }
  placeDebugTile(scene, container, wx, wy, pickFloorFrame(), { tint, liftBakePx: liftPx });
}
