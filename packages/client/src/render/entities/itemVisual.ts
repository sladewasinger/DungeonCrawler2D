// Ground-item entity wiring: feet-anchored sprite + shadow + bob/glint motion (motion
// math lives in groundItemMotion.ts / groundItemVisual.ts).
import type Phaser from "phaser";
import { ASSET_KEYS, WORLD_PIXEL_SCALE } from "../../boot/assetManifest.js";
import { applyGroundItemMotion } from "./groundItemVisual.js";
import { createShadow, updateShadowPosition } from "./shadow.js";
import type { ItemVisual } from "./state.js";
import type { ItemEntityView } from "./view.js";
import { depthForEntityNow, worldToScreen } from "./worldToScreen.js";

export function createItemVisual(scene: Phaser.Scene): ItemVisual {
  const body = scene.add.sprite(0, 0, ASSET_KEYS.atlas).setOrigin(0.5, 1).setScale(WORLD_PIXEL_SCALE);
  return { kind: "item", body, shadow: createShadow(scene, 0) };
}

export function updateItemVisual(visual: ItemVisual, view: ItemEntityView, nowMs: number): void {
  if (visual.body.frame.name !== view.frame) visual.body.setFrame(view.frame);
  const ground = worldToScreen(view.x, view.y);
  visual.body.setDepth(depthForEntityNow(view.x, view.y));
  visual.shadow.setDepth(visual.body.depth - 0.2);
  updateShadowPosition(visual.shadow, ground.x, ground.y);
  applyGroundItemMotion(visual.body, ground.x, ground.y, nowMs);
}
