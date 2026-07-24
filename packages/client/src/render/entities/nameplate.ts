/** Renders player nameplates from the pure social-state presentation resolver. */
import type Phaser from "phaser";
import { uiTextStyle } from "../../ui/font.js";
import { HUD_SCALE } from "../../ui/hudScale.js";
import { resolveNameplatePresentation } from "./nameplatePresentation.js";

const Y_OFFSET = -16 * HUD_SCALE;

export function createNameplate(scene: Phaser.Scene, depth: number): Phaser.GameObjects.Text {
  return scene.add.text(0, 0, "", uiTextStyle(10 * HUD_SCALE)).setOrigin(0.5, 1).setDepth(depth);
}

export function updateNameplate(
  text: Phaser.GameObjects.Text,
  name: string,
  headScreenX: number,
  headScreenY: number,
  distanceTiles: number,
  isParty: boolean,
  downed = false,
  disconnected = false,
): void {
  const presentation = resolveNameplatePresentation(name, distanceTiles, isParty, downed, disconnected);
  if (text.text !== presentation.label) text.setText(presentation.label);
  text.setPosition(headScreenX, headScreenY + Y_OFFSET);
  text.setColor(presentation.color);
  text.setAlpha(presentation.alpha);
}
