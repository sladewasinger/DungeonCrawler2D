import { FEATURE_FACE, type FeatureFace } from "@dc2d/engine";
import Phaser from "phaser";
import {
  ASSET_KEYS,
  SCREEN_TILE_PX,
  WORLD_PIXEL_SCALE,
} from "../../../boot/assetManifest.js";
import { depthForCapOccluder, depthForEntity, depthForGroundEffect } from "../../entities/presentation/depthSort.js";
import type { ViewOrientation } from "../../view/orientation/viewOrientation.js";
import { worldAngleToView } from "../../view/transform/viewTransform.js";
import { getViewOrientation } from "../../view/transform/viewState.js";
import { TERRAIN_PROPS, type TerrainPropKind } from "../geometry/terrainPlannerModel.js";
import {
  CAMP_FENCE_TEXTURE_KEY,
  CAMP_TENT_TEXTURE_KEY,
  RUIN_PILLAR_TEXTURE_KEY,
} from "../material/forestLandmarkTextures.js";
import { SAFE_HOUSE_TEXTURE_KEY } from "../material/safeHouseTexture.js";
import { SPAWN_HOUSE_TEXTURE_KEY } from "../material/spawnHouseTexture.js";
import type { TerrainBatches } from "../planning/terrainPlanner.js";
import { ensureForestPropTextures, FOREST_TEXTURE_KEYS } from "./forestPropTextures.js";

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
  ensureForestPropTextures(scene);
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
    .setDepth(propDepth(prop.prop, prop.viewTile.y))
    .setVisible(root.orientation === getViewOrientation());
  root.props.set(key, sprite);
}

function propDepth(prop: TerrainPropKind, viewTileY: number): number {
  if (prop === TERRAIN_PROPS.Water || prop === TERRAIN_PROPS.Bridge) {
    return depthForGroundEffect(viewTileY);
  }
  if (prop === TERRAIN_PROPS.SafeHouse || prop === TERRAIN_PROPS.SpawnHouse) {
    return depthForEntity(viewTileY + 0.95);
  }
  if (prop === TERRAIN_PROPS.ArenaGate) return depthForCapOccluder(viewTileY) + 0.1;
  return depthForEntity(viewTileY + 0.85);
}

interface PropVisual {
  readonly texture: string;
  readonly frame?: string;
  readonly scale: number;
  readonly originY: number;
  readonly anchorY: number;
  readonly angle: number;
}

const FOREST_TEXTURE_BY_PROP: Readonly<Partial<Record<TerrainPropKind, string>>> = {
  ...FOREST_TEXTURE_KEYS,
  [TERRAIN_PROPS.CampTent]: CAMP_TENT_TEXTURE_KEY,
  [TERRAIN_PROPS.CampFence]: CAMP_FENCE_TEXTURE_KEY,
  [TERRAIN_PROPS.RuinPillar]: RUIN_PILLAR_TEXTURE_KEY,
  [TERRAIN_PROPS.SafeHouse]: SAFE_HOUSE_TEXTURE_KEY,
  [TERRAIN_PROPS.SpawnHouse]: SPAWN_HOUSE_TEXTURE_KEY,
};

function propVisual(
  prop: TerrainBatches["props"][number],
  orientation: ViewOrientation,
): PropVisual {
  if (prop.prop === TERRAIN_PROPS.ArenaGate) return arenaGateVisual(prop.featureFace, orientation);
  const forestTexture = FOREST_TEXTURE_BY_PROP[prop.prop];
  if (forestTexture) {
    const centered = prop.prop === TERRAIN_PROPS.Water || prop.prop === TERRAIN_PROPS.Bridge;
    return centered ? centeredPropVisual(forestTexture) : standingPropVisual(forestTexture);
  }
  const frame = prop.prop === TERRAIN_PROPS.CraftingTable ? "crafting_table" : "chest_full_open_anim_f0";
  return standingPropVisual(ASSET_KEYS.atlas, frame);
}

function arenaGateVisual(face: FeatureFace | undefined, orientation: ViewOrientation): PropVisual {
  return {
    texture: ASSET_KEYS.arenaGate,
    scale: SCREEN_TILE_PX / ARENA_GATE_SOURCE_PX,
    originY: 0.5,
    anchorY: 0.5,
    angle: gateAngle(face, orientation),
  };
}

function centeredPropVisual(texture: string): PropVisual {
  return { texture, scale: WORLD_PIXEL_SCALE, originY: 0.5, anchorY: 0.5, angle: 0 };
}

function standingPropVisual(texture: string, frame?: string): PropVisual {
  return {
    texture,
    ...(frame === undefined ? {} : { frame }),
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
