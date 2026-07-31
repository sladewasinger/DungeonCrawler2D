import type Phaser from "phaser";
import type { AdminDebugPoint } from "./adminDebugGeometry.js";
import { gameplayDebugScreenPoint } from "./gameplayDebugProjection.js";

export interface GameplayDebugLineInput {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly points: readonly AdminDebugPoint[];
  readonly color: number;
  readonly width?: number;
  readonly alpha?: number;
}

export function drawGameplayLine(input: GameplayDebugLineInput): void {
  if (input.points.length < 2) return;
  const first = gameplayDebugScreenPoint(input.points[0]!);
  input.graphics.lineStyle(input.width ?? 1, input.color, input.alpha ?? 0.9);
  input.graphics.beginPath();
  input.graphics.moveTo(first.x, first.y);
  for (const point of input.points.slice(1)) {
    const screen = gameplayDebugScreenPoint(point);
    input.graphics.lineTo(screen.x, screen.y);
  }
  input.graphics.strokePath();
}

export function drawGameplayWorldMarker(
  graphics: Phaser.GameObjects.Graphics,
  point: AdminDebugPoint,
  color: number,
): void {
  const size = 0.18;
  drawGameplayLine({
    graphics,
    points: [{ x: point.x - size, y: point.y, z: point.z }, { x: point.x + size, y: point.y, z: point.z }],
    color,
  });
  drawGameplayLine({
    graphics,
    points: [{ x: point.x, y: point.y - size, z: point.z }, { x: point.x, y: point.y + size, z: point.z }],
    color,
  });
}
