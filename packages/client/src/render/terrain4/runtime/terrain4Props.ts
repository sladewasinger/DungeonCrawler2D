import Phaser from "phaser";
import { ASSET_KEYS, SCREEN_TILE_PX, WORLD_PIXEL_SCALE } from "../../../boot/assetManifest.js";
import { depthForCapOccluder } from "../../entities/presentation/depthSort.js";
import { getViewOrientation } from "../../view/transform/viewState.js";
import type { Terrain4Batches } from "../planning/terrainPlanner.js";
import type { ViewOrientation } from "../../view/orientation/viewOrientation.js";

export interface Terrain4PropRoot {
  readonly props: Map<string, Phaser.GameObjects.Sprite>;
  readonly orientation: ViewOrientation;
}

export function syncTerrain4Props({ scene, root, props }: {
  readonly scene: Phaser.Scene;
  readonly root: Terrain4PropRoot;
  readonly props: Terrain4Batches["props"];
}): void {
  const active = new Set<string>();
  for (const prop of props) syncProp({ scene, root, prop, active });
  for (const [key, sprite] of root.props) {
    if (active.has(key)) continue;
    sprite.destroy();
    root.props.delete(key);
  }
}

function syncProp({ scene, root, prop, active }: {
  readonly scene: Phaser.Scene;
  readonly root: Terrain4PropRoot;
  readonly prop: Terrain4Batches["props"][number];
  readonly active: Set<string>;
}): void {
  const key = `${prop.worldTile.x},${prop.worldTile.y}`;
  active.add(key);
  const frame = prop.prop === "crafting-table" ? "crafting_table" : "chest_full_open_anim_f0";
  const sprite = root.props.get(key) ?? scene.add.sprite(0, 0, ASSET_KEYS.atlas, frame);
  sprite.setTexture(ASSET_KEYS.atlas, frame)
    .setOrigin(0.5, 1).setScale(WORLD_PIXEL_SCALE)
    .setPosition((prop.viewTile.x + 0.5) * SCREEN_TILE_PX, (prop.viewTile.y + 1) * SCREEN_TILE_PX - prop.height * SCREEN_TILE_PX)
    .setDepth(depthForCapOccluder(prop.viewTile.y) + 0.1)
    .setVisible(root.orientation === getViewOrientation());
  root.props.set(key, sprite);
}
