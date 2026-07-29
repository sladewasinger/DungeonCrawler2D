/**
 * One panel language for every HUD/menu surface (docs/VISUAL_DIRECTION.md
 * §UI): dark, slightly translucent panels, a thin low-contrast border, an 8px
 * spacing grid, gold selection accents. Quiet by design — the panel is a
 * backdrop for its content, not a decorative frame around it.
 */
import type Phaser from "phaser";

/** Panel fill. */
export const PANEL_FILL = 0x1a1a24;
/** Panel fill alpha — a hair short of opaque so the panel reads as a soft
 * scrim over the dungeon rather than a flat, billboard-like card. */
export const PANEL_FILL_ALPHA = 0.92;
/** Panel border — deliberately close in value to the fill so it separates a
 * panel from the world without drawing the eye as a bright outline. */
export const PANEL_BORDER = 0x3c3c48;
/** Gold accent for selection/highlight states — reused from the loot/gold palette entry. */
export const SELECTION_ACCENT = 0xffd23d;

export const PANEL_BORDER_WIDTH = 1;
export const PANEL_CORNER_RADIUS = 4;
/** Base spacing unit every panel's internal padding/gaps are multiples of. */
export const PANEL_SPACING = 8;

/** Draws a dark 9-slice-style panel background + border at local (0,0)..(width,height). */
export function drawPanelBackground(scene: Phaser.Scene, width: number, height: number): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics();
  graphics.fillStyle(PANEL_FILL, PANEL_FILL_ALPHA);
  graphics.fillRoundedRect(0, 0, width, height, PANEL_CORNER_RADIUS);
  graphics.lineStyle(PANEL_BORDER_WIDTH, PANEL_BORDER, 1);
  graphics.strokeRoundedRect(0.5, 0.5, width - 1, height - 1, PANEL_CORNER_RADIUS);
  return graphics;
}

/** Draws the gold selection outline used to mark the active hotbar slot / list row / tab. */
export function drawSelectionAccent(scene: Phaser.Scene, width: number, height: number): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics();
  graphics.lineStyle(PANEL_BORDER_WIDTH, SELECTION_ACCENT, 1);
  graphics.strokeRoundedRect(0.5, 0.5, width - 1, height - 1, PANEL_CORNER_RADIUS);
  return graphics;
}

/** Snaps a raw pixel amount to the panel spacing grid — use for all panel padding/gaps. */
export function spacing(units: number): number {
  return units * PANEL_SPACING;
}
