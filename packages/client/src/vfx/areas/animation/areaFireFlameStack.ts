import Phaser from "phaser";
import { ASSET_KEYS } from "../../../boot/assetManifest.js";
import { AREA_FLOOR_FIRE_FLAMES } from "../presentation/areaVisualStyle.js";
import {
  createFloorFireFlameStates,
  updateFloorFireFlameState,
  type FloorFireFlameState,
} from "./floorFireFlameMotion.js";

interface FlameLayer {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly state: FloorFireFlameState;
}

export interface AreaFireFlameStack {
  sync(placement: AreaFireFlamePlacement): void;
  deactivate(): void;
  destroy(): void;
}

export interface AreaFireFlamePlacement {
  readonly screen: Readonly<{ x: number; y: number }>;
  readonly depth: number;
  readonly nowMs: number;
  readonly phaseOffset: number;
}

export function createAreaFireFlameStack(
  scene: Phaser.Scene,
): AreaFireFlameStack {
  const states = createFloorFireFlameStates();
  const layers = states.map((state, index) => ({
    sprite: createFlameLayer(scene, index),
    state,
  }));
  return {
    sync: (placement) => syncLayers(layers, placement),
    deactivate: () => setLayersActive(layers, false),
    destroy: () => destroyLayers(layers),
  };
}

function createFlameLayer(
  scene: Phaser.Scene,
  index: number,
): Phaser.GameObjects.Sprite {
  const layer = AREA_FLOOR_FIRE_FLAMES.layers[index];
  return scene.add
    .sprite(0, 0, ASSET_KEYS.atlas, "area_fire_flame")
    .setOrigin(0.5, 0.72)
    .setTint(layer?.color ?? 0xff9e3d)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setVisible(false)
    .setActive(false);
}

function syncLayers(
  layers: readonly FlameLayer[],
  placement: AreaFireFlamePlacement,
): void {
  for (let index = 0; index < layers.length; index++) {
    const layer = layers[index];
    if (!layer) continue;
    updateFloorFireFlameState({
      state: layer.state,
      index,
      nowMs: placement.nowMs,
      phaseOffset: placement.phaseOffset,
    });
    syncLayerSprite(
      layer,
      placement.screen,
      placement.depth + index * 0.001,
    );
  }
}

function syncLayerSprite(
  layer: FlameLayer,
  screen: Readonly<{ x: number; y: number }>,
  depth: number,
): void {
  const { sprite, state } = layer;
  sprite
    .setPosition(screen.x + state.xOffset, screen.y + state.yOffset)
    .setDepth(depth)
    .setScale(state.scaleX, state.scaleY)
    .setAngle(state.angle)
    .setAlpha(state.alpha)
    .setVisible(true)
    .setActive(true);
}

function setLayersActive(
  layers: readonly FlameLayer[],
  active: boolean,
): void {
  for (const { sprite } of layers) {
    sprite.setVisible(active).setActive(active);
  }
}

function destroyLayers(layers: readonly FlameLayer[]): void {
  for (const { sprite } of layers) sprite.destroy();
}
