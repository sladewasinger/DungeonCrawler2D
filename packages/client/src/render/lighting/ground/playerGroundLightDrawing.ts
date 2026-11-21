import Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../../boot/assetManifest.js";
import { depthForCapOccluder } from "../../entities/presentation/depthSort.js";
import { worldToScreen } from "../../entities/geometry/worldToScreen.js";
import { getViewOrientation } from "../../view/transform/viewState.js";
import { worldTileToView } from "../../view/transform/viewTransform.js";
import { LIGHTING_VISUAL_STYLE, lightingColor } from "../lightingVisualStyle.js";
import type { PlayerGroundLightCell } from "./playerGroundLight.js";

const LIGHT_COLOR = lightingColor(LIGHTING_VISUAL_STYLE.ground.color);
const FLOOR_LAYER_BIAS = LIGHTING_VISUAL_STYLE.ground.floorLayerBias;
export const PLAYER_GROUND_LIGHT_ALPHA = LIGHTING_VISUAL_STYLE.ground.alpha;

export interface PlayerGroundLightLayerState {
  readonly key: string;
  tileX: number;
  tileY: number;
  groundHeight: number;
  depth: number;
  layer: Phaser.GameObjects.Graphics;
  alpha: number;
  startAlpha: number;
  targetAlpha: number;
  transitionStartedAtMs: number;
}

export function lightKey(cell: PlayerGroundLightCell): string {
  return `${cell.tileX},${cell.tileY}`;
}

export function lightDepth(cell: PlayerGroundLightCell): number {
  const viewTile = worldTileToView({ x: cell.tileX, y: cell.tileY }, getViewOrientation());
  return depthForCapOccluder(viewTile.y) + FLOOR_LAYER_BIAS;
}

export function createLightState(input: {
  readonly cell: PlayerGroundLightCell;
  readonly key: string;
  readonly nowMs: number;
  readonly layer: Phaser.GameObjects.Graphics;
}): PlayerGroundLightLayerState {
  const { cell, key, nowMs, layer } = input;
  const depth = lightDepth(cell);
  return {
    key, tileX: cell.tileX, tileY: cell.tileY, groundHeight: cell.groundHeight,
    depth, layer, alpha: 0, startAlpha: 0, targetAlpha: 0,
    transitionStartedAtMs: nowMs,
  };
}

export function redrawPlayerGroundLightLayers(
  layers: ReadonlyMap<number, Phaser.GameObjects.Graphics>,
  active: ReadonlyMap<string, PlayerGroundLightLayerState>,
): void {
  hidePlayerGroundLightLayers(layers);
  for (const state of active.values()) {
    if (state.alpha <= 0) continue;
    state.layer.setVisible(true).fillStyle(LIGHT_COLOR, state.alpha);
    const screen = worldToScreen(state.tileX + 0.5, state.tileY + 0.5);
    state.layer.fillRect(
      screen.x - SCREEN_TILE_PX / 2,
      screen.y - state.groundHeight * SCREEN_TILE_PX - SCREEN_TILE_PX / 2,
      SCREEN_TILE_PX,
      SCREEN_TILE_PX,
    );
  }
}

export function hidePlayerGroundLightLayers(
  layers: ReadonlyMap<number, Phaser.GameObjects.Graphics>,
): void {
  for (const layer of layers.values()) layer.clear().setVisible(false);
}

export function lightLayer(scene: Phaser.Scene, depth: number): Phaser.GameObjects.Graphics {
  return scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(depth);
}
