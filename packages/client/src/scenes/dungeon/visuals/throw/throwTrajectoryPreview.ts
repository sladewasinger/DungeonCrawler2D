import type { WorldView } from "@dc2d/engine";
import type Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../../../boot/assetManifest.js";
import type { ThrowPreview } from "../../../../input/index.js";
import {
  groundToScreen,
  worldToScreen,
} from "../../../../render/entities/geometry/worldToScreen.js";
import { spriteLiftPx } from "../../../../render/entities/motion/lift.js";
import {
  parabolicThrowArc,
  type ThrowArcPoint,
} from "./throwTrajectoryGeometry.js";

const PREVIEW_DEPTH = 100_000;
const ARC_TINT = 0xffd54c;
const ARC_ALPHA = 0.9;
const LANDING_RADIUS_PX = SCREEN_TILE_PX * 0.24;

export interface ThrowTrajectoryInput {
  readonly preview: ThrowPreview | null;
  readonly origin: ThrowArcPoint;
  readonly world: WorldView;
}

export class ThrowTrajectoryPreview {
  private readonly graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add
      .graphics()
      .setDepth(PREVIEW_DEPTH)
      .setVisible(false);
  }

  sync(input: ThrowTrajectoryInput): void {
    if (!input.preview) {
      this.hide();
      return;
    }
    const target = trajectoryTarget(input.preview, input.world);
    const points = parabolicThrowArc({
      origin: { ...input.origin, z: input.origin.z + 0.7 },
      target,
    });
    this.graphics.setVisible(true).clear();
    drawArc(this.graphics, points);
    drawLandingMarker(this.graphics, target);
  }

  hide(): void {
    this.graphics.setVisible(false);
  }

  dispose(): void {
    this.graphics.destroy();
  }
}

function trajectoryTarget(
  preview: ThrowPreview,
  world: WorldView,
): ThrowArcPoint {
  const { targetX: x, targetY: y } = preview;
  return { x, y, z: world.groundAt(x, y) + 0.08 };
}

function drawArc(
  graphics: Phaser.GameObjects.Graphics,
  points: readonly ThrowArcPoint[],
): void {
  const first = pointToScreen(points[0]!);
  graphics.lineStyle(2, ARC_TINT, ARC_ALPHA);
  graphics.beginPath().moveTo(first.x, first.y);
  for (const point of points.slice(1)) {
    const screen = pointToScreen(point);
    graphics.lineTo(screen.x, screen.y);
  }
  graphics.strokePath();
}

function drawLandingMarker(
  graphics: Phaser.GameObjects.Graphics,
  target: ThrowArcPoint,
): void {
  const screen = groundToScreen(target.x, target.y, target.z);
  graphics.lineStyle(3, ARC_TINT, 1);
  graphics.strokeCircle(screen.x, screen.y, LANDING_RADIUS_PX);
  graphics.fillStyle(ARC_TINT, 0.3);
  graphics.fillCircle(screen.x, screen.y, LANDING_RADIUS_PX * 0.55);
}

function pointToScreen(point: ThrowArcPoint): { x: number; y: number } {
  const screen = worldToScreen(point.x, point.y);
  return { x: screen.x, y: screen.y - spriteLiftPx(point.z) };
}
