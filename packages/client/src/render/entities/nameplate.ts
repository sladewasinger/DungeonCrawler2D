/** Renders entity nameplates from the pure social-state presentation resolver. */
import type Phaser from "phaser";
import { uiTextStyle } from "../../ui/font.js";
import { HUD_SCALE } from "../../ui/hudScale.js";
import { resolveNameplatePresentation } from "./nameplatePresentation.js";

export const NAMEPLATE_GAP_PX = 2 * HUD_SCALE;
export const NAMEPLATE_LINE_HEIGHT_PX = 10 * HUD_SCALE;
export const LABEL_LINE_GAP_PX = 2 * HUD_SCALE;
const NAMEPLATE_FONT_SIZE_PX = 10 * HUD_SCALE;
const NAMEPLATE_STROKE_COLOR = "#000000";
const NAMEPLATE_STROKE_PX = 3;

export function createNameplate(scene: Phaser.Scene, depth: number): Phaser.GameObjects.Text {
  return scene.add.text(0, 0, "", uiTextStyle(NAMEPLATE_FONT_SIZE_PX))
    .setOrigin(0.5, 1)
    .setStroke(NAMEPLATE_STROKE_COLOR, NAMEPLATE_STROKE_PX)
    .setDepth(depth);
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
  additionalOffsetPx = 0,
): void {
  void isParty;
  const presentation = resolveNameplatePresentation(name, distanceTiles, downed, disconnected);
  if (text.text !== presentation.label) text.setText(presentation.label);
  text.setPosition(headScreenX, headScreenY - NAMEPLATE_GAP_PX - additionalOffsetPx);
  text.setColor("#ffffff");
  text.setAlpha(presentation.alpha);
}
