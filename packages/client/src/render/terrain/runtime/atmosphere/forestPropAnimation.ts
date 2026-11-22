/** Time-driven wind sway on forest trees/bushes and shimmer ripple on water tiles. */
import type Phaser from "phaser";
import { TERRAIN_PROPS } from "../../geometry/terrainPlannerModel.js";
import { FOREST_TEXTURE_KEYS } from "../forestPropTextures.js";

const TREE_KEY = FOREST_TEXTURE_KEYS[TERRAIN_PROPS.Tree];
const BUSH_KEY = FOREST_TEXTURE_KEYS[TERRAIN_PROPS.Bush];
const WATER_KEY = FOREST_TEXTURE_KEYS[TERRAIN_PROPS.Water];

export function animateForestTerrainProps(
  props: Iterable<Phaser.GameObjects.Sprite>,
  nowMs: number,
): void {
  for (const sprite of props) {
    if (!sprite.visible) continue;
    const key = sprite.texture.key;
    if (key === TREE_KEY) applyWindSway(sprite, nowMs, 0.024);
    else if (key === BUSH_KEY) applyWindSway(sprite, nowMs, 0.036);
    else if (key === WATER_KEY) applyWaterShimmer(sprite, nowMs);
  }
}

function applyWindSway(
  sprite: Phaser.GameObjects.Sprite,
  nowMs: number,
  amplitude: number,
): void {
  const phase = sprite.x * 0.013 + sprite.y * 0.017;
  const gust = Math.sin(nowMs * 0.0018 + phase) * 0.7 + Math.sin(nowMs * 0.0009 + phase * 0.5) * 0.3;
  sprite.setRotation(gust * amplitude);
}

function applyWaterShimmer(sprite: Phaser.GameObjects.Sprite, nowMs: number): void {
  const wave = 0.5 + 0.5 * Math.sin(nowMs * 0.0032 + sprite.x * 0.035 + sprite.y * 0.028);
  sprite.setAlpha(0.87 + wave * 0.13);
  sprite.setTint(wave > 0.68 ? 0xd9f6ff : 0xffffff);
}
