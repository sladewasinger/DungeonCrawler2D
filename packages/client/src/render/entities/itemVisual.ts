// Ground-item entity wiring: feet-anchored sprite + shadow + bob/glint motion (motion
// math lives in groundItemMotion.ts / groundItemVisual.ts).
import type Phaser from "phaser";
import { ASSET_KEYS, WORLD_PIXEL_SCALE } from "../../boot/assetManifest.js";
import { uiTextStyle } from "../../ui/font.js";
import { applyGroundItemMotion } from "./groundItemVisual.js";
import { createShadow, updateShadowPosition } from "./shadow.js";
import type { ItemVisual } from "./state.js";
import type { ItemEntityView } from "./view.js";
import { worldToScreen } from "./worldToScreen.js";
import { groundedVisualPlacement } from "../../vfx/groundPlaneDepth.js";

export function createItemVisual(scene: Phaser.Scene): ItemVisual {
  const body = scene.add.sprite(0, 0, ASSET_KEYS.atlas).setOrigin(0.5, 1).setScale(WORLD_PIXEL_SCALE);
  const label = scene.add.text(0, 0, "", uiTextStyle(10, "#f4d7b2", 1, "emphasis"))
    .setOrigin(0.5, 1).setAlign("center").setVisible(false);
  const timer = scene.add.text(0, 0, "", uiTextStyle(9, "#ffd86a"))
    .setOrigin(0.5, 0).setVisible(false);
  return { kind: "item", body, shadow: createShadow(scene, 0), label, timer };
}

export function updateItemVisual(visual: ItemVisual, view: ItemEntityView, nowMs: number): void {
  if (visual.body.frame.name !== view.frame) visual.body.setFrame(view.frame);
  const ground = worldToScreen(view.x, view.y);
  const placement = groundedVisualPlacement(ground.y, view.z, "item");
  visual.body.setDepth(placement.depth);
  visual.shadow.setDepth(visual.body.depth - 0.2);
  updateShadowPosition(visual.shadow, ground.x, placement.projectedScreenY);
  if (!view.lootLabel) {
    visual.label.setVisible(false); visual.timer.setVisible(false);
    applyGroundItemMotion(visual.body, ground.x, placement.projectedScreenY, nowMs);
    return;
  }
  visual.body.clearTint().setPosition(ground.x, placement.projectedScreenY);
  visual.label
    .setText(`${view.lootLabel}${view.lootKillerName ? `\nKilled by ${view.lootKillerName}` : ""}`)
    .setPosition(ground.x, placement.projectedScreenY - visual.body.displayHeight - 4)
    .setDepth(visual.body.depth + 1)
    .setVisible(true);
  visual.timer
    .setText(view.lootLockSeconds ? `First dibs: ${view.lootLockSeconds}s` : "Loot unlocked")
    .setPosition(ground.x, placement.projectedScreenY + 5)
    .setDepth(visual.body.depth + 1)
    .setVisible(view.lootNearby ?? false);
}
