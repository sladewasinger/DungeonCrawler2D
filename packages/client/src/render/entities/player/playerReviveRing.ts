import type Phaser from "phaser";
import type { PlayerEntityView } from "../visuals/view.js";
import { depthForScreenY } from "../geometry/worldToScreen.js";
import { drawHoldProgressRing } from "../presentation/holdProgressRing.js";

const REVIVE_RING_DEPTH_BIAS = 0.5;

/** Draws the authoritative AOI-visible hold ring above a downed crawler. */
export function updatePlayerReviveRing(
  ring: Phaser.GameObjects.Graphics | undefined,
  body: Phaser.GameObjects.Sprite,
  view: PlayerEntityView,
): void {
  if (!ring) return;
  const progress = view.downed ? Math.max(0, Math.min(1, view.reviveProgress ?? 0)) : 0;
  if (progress <= 0) {
    ring.setVisible(false);
    return;
  }
  const ringY = body.y - body.displayHeight - 5;
  drawReviveRing({ ring, x: body.x, ringY, progress });
  ring.setDepth(depthForScreenY(ringY) + REVIVE_RING_DEPTH_BIAS).setVisible(true);
}

interface ReviveRingDrawing {
  readonly ring: Phaser.GameObjects.Graphics;
  readonly x: number;
  readonly ringY: number;
  readonly progress: number;
}

function drawReviveRing({ ring, x, ringY, progress }: ReviveRingDrawing): void {
  drawHoldProgressRing({ graphics: ring, x, y: ringY, progress });
}
