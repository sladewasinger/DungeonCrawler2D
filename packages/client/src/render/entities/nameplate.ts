// Nameplates: small, dimmed until nearby, teal for party — the palette carries the
// social information per VISUAL_DIRECTION's UI section.
import type Phaser from "phaser";
import { pixelTextStyle } from "../../ui/font.js";

const NEAR_DISTANCE_TILES = 6;
const PARTY_COLOR = "#3dd6c3";
const STRANGER_COLOR = "#9a9aae";
const DIM_ALPHA = 0.35;
const NEAR_ALPHA = 0.95;
const Y_OFFSET = -16;

export function createNameplate(scene: Phaser.Scene, depth: number): Phaser.GameObjects.Text {
  return scene.add.text(0, 0, "", pixelTextStyle(10)).setOrigin(0.5, 1).setDepth(depth);
}

/** Repositions/recolors a nameplate above an entity's head: teal for party, dimmed grey otherwise. */
export function updateNameplate(
  text: Phaser.GameObjects.Text,
  name: string,
  headScreenX: number,
  headScreenY: number,
  distanceTiles: number,
  isParty: boolean,
): void {
  if (text.text !== name) text.setText(name);
  text.setPosition(headScreenX, headScreenY + Y_OFFSET);
  text.setColor(isParty ? PARTY_COLOR : STRANGER_COLOR);
  text.setAlpha(distanceTiles <= NEAR_DISTANCE_TILES ? NEAR_ALPHA : DIM_ALPHA);
}
