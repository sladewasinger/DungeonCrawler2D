/** Renders entity nameplates from the pure social-state presentation resolver. */
import type Phaser from "phaser";
import { uiTextStyle } from "../../../ui/foundation/font.js";
import { HUD_SCALE } from "../../../ui/foundation/hudScale.js";
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

export interface NameplateUpdate {
  readonly text: Phaser.GameObjects.Text;
  readonly name: string;
  readonly headScreenX: number;
  readonly headScreenY: number;
  readonly distanceTiles: number;
  readonly isParty: boolean;
  readonly downed?: boolean;
  readonly disconnected?: boolean;
  readonly additionalOffsetPx?: number;
}

export function updateNameplate({
  text,
  name,
  headScreenX,
  headScreenY,
  distanceTiles,
  isParty,
  downed = false,
  disconnected = false,
  additionalOffsetPx = 0,
}: NameplateUpdate): void {
  void isParty;
  const presentation = resolveNameplatePresentation({ name, distanceTiles, downed, disconnected });
  if (text.text !== presentation.label) text.setText(presentation.label);
  text.setPosition(headScreenX, headScreenY - NAMEPLATE_GAP_PX - additionalOffsetPx);
  text.setColor("#ffffff");
  text.setAlpha(presentation.alpha);
}
