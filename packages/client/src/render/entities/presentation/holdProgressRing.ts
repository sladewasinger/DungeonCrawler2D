import type Phaser from "phaser";
import { HUD_SCALE } from "../../../ui/foundation/hudScale.js";
import { SELECTION_ACCENT } from "../../../ui/foundation/panel.js";

export const HOLD_RING_RADIUS_PX = 14 * HUD_SCALE;
const HOLD_RING_THICKNESS_PX = 3;

export interface HoldProgressRingDrawing {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly x: number;
  readonly y: number;
  readonly progress: number;
}

/** Shared yellow hold-progress treatment used by fistbumps and revives. */
export function drawHoldProgressRing(
  drawing: HoldProgressRingDrawing,
): void {
  const { graphics, x, y } = drawing;
  const progress = Math.max(0, Math.min(1, drawing.progress));
  graphics.clear();
  graphics.lineStyle(HOLD_RING_THICKNESS_PX, SELECTION_ACCENT, 0.25);
  graphics.strokeCircle(x, y, HOLD_RING_RADIUS_PX);
  graphics.lineStyle(HOLD_RING_THICKNESS_PX, SELECTION_ACCENT, 0.95);
  graphics.beginPath();
  graphics.arc(
    x,
    y,
    HOLD_RING_RADIUS_PX,
    -Math.PI / 2,
    -Math.PI / 2 + progress * Math.PI * 2,
  );
  graphics.strokePath();
}
