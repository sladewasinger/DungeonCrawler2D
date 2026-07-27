import type Phaser from "phaser";
import type { PlayerEntityView } from "../view.js";
import { depthForScreenY } from "../worldToScreen.js";

const REVIVE_RING_RADIUS_PX = 11;
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
  ring.clear();
  ring.lineStyle(2, 0x8fffc1, 0.3);
  ring.strokeCircle(x, ringY, REVIVE_RING_RADIUS_PX);
  ring.lineStyle(2, 0x8fffc1, 0.95);
  ring.beginPath();
  ring.arc(
    x,
    ringY,
    REVIVE_RING_RADIUS_PX,
    -Math.PI / 2,
    -Math.PI / 2 + progress * Math.PI * 2,
  );
  ring.strokePath();
}
