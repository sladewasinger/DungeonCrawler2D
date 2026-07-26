import { TILE, type StairVisual, type TileType } from "@dc2d/engine";
import type Phaser from "phaser";
import { pickFloorFrame, pickStairFrame } from "./debugArt.js";
import { placeDebugTile } from "./debugSprite.js";
import { drawSideStair } from "./sideStair.js";
import { screenClimbDirIndex } from "./stairScreenDirection.js";
import { drawStairTreads } from "./drawStairTread.js";
import { stacksVertically } from "./stairTread.js";
import type { ViewTerrainWorld } from "./viewWorld.js";

export interface StairRenderState {
  screenDirection: number;
  sideStair: boolean;
}

export function stairRenderState(
  tile: TileType,
  stairVisual: StairVisual | null,
  world: ViewTerrainWorld,
): StairRenderState {
  const screenDirection = stairVisual ? screenClimbDirIndex(stairVisual.direction, world.orientation) : 0;
  return {
    screenDirection,
    sideStair: tile === TILE.Stairs && stairVisual !== null && !stacksVertically(screenDirection),
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
  if (state.sideStair) drawSideStair(scene, container, world, wx, wy, lightTint);
  else placeDebugTile(scene, container, wx, wy, pickFloorFrame(), { tint, liftPx });
}

export function drawStairDetails(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  wx: number,
  wy: number,
  tile: TileType,
  stairVisual: StairVisual | null,
  state: StairRenderState,
  tint: number,
  lightTint: number,
  liftPx: number,
): void {
  if (tile === TILE.Stairs && stairVisual && !state.sideStair) {
    placeDebugTile(scene, container, wx, wy, pickStairFrame(state.screenDirection), { tint, liftPx });
  }
  if (stairVisual && !state.sideStair) {
    drawStairTreads(scene, container, wx, wy, state.screenDirection, stairVisual.t, lightTint, liftPx);
  }
}
