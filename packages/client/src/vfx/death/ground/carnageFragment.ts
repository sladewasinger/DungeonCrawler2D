import Phaser from "phaser";
import { ASSET_KEYS } from "../../../boot/assetManifest.js";
import type { CarnageMark } from "../deathCarnageDrawing.js";

export function growCarnageFragment(scene: Phaser.Scene, mark: CarnageMark): Phaser.GameObjects.Sprite {
  const fragment = scene.add
    .sprite(0, 0, ASSET_KEYS.atlas)
    .setName("gore-sprite-fragment")
    .setOrigin(0.5)
    .setActive(false)
    .setVisible(false);
  mark.fragments.push(fragment);
  return fragment;
}
