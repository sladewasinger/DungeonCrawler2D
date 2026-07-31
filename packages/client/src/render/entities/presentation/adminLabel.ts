import type Phaser from "phaser";
import { uiTextStyle } from "../../../ui/foundation/font.js";
import { HUD_SCALE } from "../../../ui/foundation/hudScale.js";
import {
  LABEL_LINE_GAP_PX,
  NAMEPLATE_LINE_HEIGHT_PX,
} from "./nameplate.js";

const ADMIN_COLOR = "#54a8ff";
const ADMIN_STROKE_COLOR = "#07101d";

export function createAdminLabel(
  scene: Phaser.Scene,
  depth: number,
): Phaser.GameObjects.Text {
  return scene.add.text(0, 0, "[ADMIN]", {
    ...uiTextStyle(9 * HUD_SCALE),
    color: ADMIN_COLOR,
    fontStyle: "bold",
  })
    .setOrigin(0.5, 1)
    .setStroke(ADMIN_STROKE_COLOR, 3)
    .setDepth(depth)
    .setVisible(false);
}

export function updateAdminLabel(input: {
  readonly label: Phaser.GameObjects.Text;
  readonly nameplate: Phaser.GameObjects.Text;
  readonly visible: boolean;
}): void {
  const { label, nameplate, visible } = input;
  label.setVisible(visible);
  if (!visible) return;
  label.setPosition(nameplate.x, nameplate.y + NAMEPLATE_LINE_HEIGHT_PX + LABEL_LINE_GAP_PX);
  label.setDepth(nameplate.depth + 0.01);
  label.setAlpha(nameplate.alpha);
}
