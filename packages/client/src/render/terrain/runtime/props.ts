import { FEATURE_FACE, type FeatureFace } from "@dc2d/engine";
import Phaser from "phaser";
import {
  ASSET_KEYS,
  SCREEN_TILE_PX,
  WORLD_PIXEL_SCALE,
} from "../../../boot/assetManifest.js";
import { depthForCapOccluder } from "../../entities/presentation/depthSort.js";
import type { ViewOrientation } from "../../view/orientation/viewOrientation.js";
import { worldAngleToView } from "../../view/transform/viewTransform.js";
import { getViewOrientation } from "../../view/transform/viewState.js";
import type { TerrainBatches } from "../planning/terrainPlanner.js";

const ARENA_GATE_SOURCE_PX = 64;

export interface TerrainPropRoot {
  readonly props: Map<string, Phaser.GameObjects.Sprite>;
  readonly orientation: ViewOrientation;
}

export function syncTerrainProps({ scene, root, props }: {
  readonly scene: Phaser.Scene;
  readonly root: TerrainPropRoot;
  readonly props: TerrainBatches["props"];
}): void {
  const active = new Set<string>();
  for (const prop of props) syncProp({ scene, root, prop, active });
  removeInactiveProps(root, active);
}

interface PropSync {
  readonly scene: Phaser.Scene;
  readonly root: TerrainPropRoot;
  readonly prop: TerrainBatches["props"][number];
  readonly active: Set<string>;
}

function syncProp({ scene, root, prop, active }: PropSync): void {
  const key = `${prop.worldTile.x},${prop.worldTile.y}`;
  const visual = propVisual(prop, root.orientation);
  active.add(key);
  const sprite = root.props.get(key) ??
    scene.add.sprite(0, 0, visual.texture, visual.frame);
  sprite.setTexture(visual.texture, visual.frame)
    .setOrigin(0.5, visual.originY)
    .setScale(visual.scale)
    .setAngle(visual.angle)
    .setPosition(
      (prop.viewTile.x + 0.5) * SCREEN_TILE_PX,
      (prop.viewTile.y + visual.anchorY) * SCREEN_TILE_PX -
        prop.height * SCREEN_TILE_PX,
    )
    .setDepth(depthForCapOccluder(prop.viewTile.y) + 0.1)
    .setVisible(root.orientation === getViewOrientation());
  root.props.set(key, sprite);
}

interface PropVisual {
  readonly texture: string;
  readonly frame?: string;
  readonly scale: number;
  readonly originY: number;
  readonly anchorY: number;
  readonly angle: number;
}

function propVisual(
  prop: TerrainBatches["props"][number],
  orientation: ViewOrientation,
): PropVisual {
  if (prop.prop === "arena-gate") {
    return {
      texture: ASSET_KEYS.arenaGate,
      scale: SCREEN_TILE_PX / ARENA_GATE_SOURCE_PX,
      originY: 0.5,
      anchorY: 0.5,
      angle: gateAngle(prop.featureFace, orientation),
    };
  }
  return {
    texture: ASSET_KEYS.atlas,
    frame: prop.prop === "crafting-table"
      ? "crafting_table"
      : "chest_full_open_anim_f0",
    scale: WORLD_PIXEL_SCALE,
    originY: 1,
    anchorY: 1,
    angle: 0,
  };
}

function gateAngle(
  face: FeatureFace | undefined,
  orientation: ViewOrientation,
): number {
  const worldAngle = {
    [FEATURE_FACE.North]: 0,
    [FEATURE_FACE.East]: Math.PI / 2,
    [FEATURE_FACE.South]: Math.PI,
    [FEATURE_FACE.West]: -Math.PI / 2,
    [FEATURE_FACE.Top]: 0,
  }[face ?? FEATURE_FACE.Top];
  return worldAngleToView(worldAngle, orientation) * 180 / Math.PI;
}

function removeInactiveProps(
  root: TerrainPropRoot,
  active: ReadonlySet<string>,
): void {
  for (const [key, sprite] of root.props) {
    if (active.has(key)) continue;
    sprite.destroy();
    root.props.delete(key);
  }
}
