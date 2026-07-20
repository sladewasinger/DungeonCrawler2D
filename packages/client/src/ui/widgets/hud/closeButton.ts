/**
 * Reusable [X] close control for the HUD's centered window panels (inventory/
 * contacts/craft/stash) — floats just outside the panel's top-right corner so
 * it never collides with existing top-row chrome (inventory's tabs, the other
 * three windows' title text), with an oversized invisible hit box for a thumb
 * on mobile. A real interactive Phaser object wired straight to the caller's
 * close(), mirroring the Drop/Equip/Craft/DM button pattern every window
 * already uses — not routed through HudWidgets.hitTest()'s string dispatch.
 */
import type Phaser from "phaser";
import { uiTextStyle } from "../../font.js";
import { PANEL_BORDER, PANEL_FILL } from "../../panel.js";

/** Visible glyph box — small enough to read as a corner accessory, not a fifth panel button. */
const VISUAL_SIZE = 22;
/** Invisible tap target — bigger than the glyph so a thumb doesn't need pixel accuracy. */
const HIT_SIZE = 32;
/** Gap between the panel's top border and the hit box's bottom edge, so the (larger) hit
 * box never overlaps a window's own top-row content (tabs/title) at any panel size. */
const CLEARANCE = 2;

export interface CloseButtonHandle {
  /** Add these to the panel container alongside every other row/tab object. */
  objects: Phaser.GameObjects.GameObject[];
  /** Bounds-only hit rect, for a window's hitTestPanel() to fold into its own claim. */
  hitArea: Phaser.GameObjects.Rectangle;
}

/** Builds the close control at a panel's top-right corner, in the panel's own local space. */
export function buildCloseButton(
  scene: Phaser.Scene,
  panelWidth: number,
  panelHeight: number,
  containerScale: number,
  onClose: () => void,
): CloseButtonHandle {
  const x = panelWidth / 2 - VISUAL_SIZE / 2;
  const y = -panelHeight / 2 - HIT_SIZE / 2 - CLEARANCE;
  const hitArea = scene.add.rectangle(x, y, HIT_SIZE, HIT_SIZE, 0x000000, 0).setInteractive({ useHandCursor: true });
  hitArea.on("pointerdown", onClose);
  const glyph = scene.add
    .rectangle(x, y, VISUAL_SIZE, VISUAL_SIZE, PANEL_FILL, 0.95)
    .setStrokeStyle(1, PANEL_BORDER);
  // `scale` folds in the panel's container transform (font.ts's uiTextStyle header
  // comment) so the × glyph stays crisp — every other window control already does this.
  const label = scene.add.text(x, y, "×", uiTextStyle(14, undefined, containerScale)).setOrigin(0.5, 0.5);
  return { objects: [hitArea, glyph, label], hitArea };
}
