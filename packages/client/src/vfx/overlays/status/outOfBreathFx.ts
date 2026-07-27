import type Phaser from "phaser";
import { spriteLiftPx } from "../../../render/entities/motion/lift.js";
import { worldToScreen } from "../../../render/entities/geometry/worldToScreen.js";
import type { OutOfBreathVfxInput } from "../../system/vfxSystemTypes.js";

const DEPTH = 400_000;
const PERIOD_MS = 900;
const PUFF_COUNT = 3;
const COLOR = 0xd8e5ea;

export interface BreathPuffPose {
  readonly x: number;
  readonly y: number;
  readonly alpha: number;
  readonly radius: number;
}

export function breathScreenAnchor(
  worldX: number,
  worldY: number,
  worldZ: number,
): { x: number; y: number } {
  const screen = worldToScreen(worldX, worldY - 0.85);
  return { x: screen.x, y: screen.y - spriteLiftPx(worldZ) };
}

export function breathPuffPose(
  nowMs: number,
  index: number,
  facingSign: number,
): BreathPuffPose {
  const phase = ((nowMs / PERIOD_MS + index / PUFF_COUNT) % 1 + 1) % 1;
  return {
    x: facingSign * (10 + phase * 22),
    y: -phase * 15,
    alpha: Math.sin(phase * Math.PI) * 0.72,
    radius: 2.5 + phase * 3.5,
  };
}

export class OutOfBreathFx {
  private readonly graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(DEPTH).setVisible(false);
  }

  sync({ x: worldX, y: worldY, z: worldZ, faceX, exhausted, nowMs }: OutOfBreathVfxInput): void {
    if (!exhausted) {
      this.graphics.setVisible(false);
      return;
    }
    const screen = breathScreenAnchor(worldX, worldY, worldZ);
    const facingSign = faceX < 0 ? -1 : 1;
    this.graphics.setVisible(true).clear();
    for (let index = 0; index < PUFF_COUNT; index++) {
      const puff = breathPuffPose(nowMs, index, facingSign);
      this.graphics.fillStyle(COLOR, puff.alpha);
      this.graphics.fillCircle(
        screen.x + puff.x,
        screen.y + puff.y,
        puff.radius,
      );
    }
  }

  dispose(): void {
    this.graphics.destroy();
  }
}
