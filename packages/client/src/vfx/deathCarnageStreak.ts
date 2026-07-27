import type Phaser from "phaser";
import { worldToScreen } from "../render/entities/worldToScreen.js";

export interface CarnageStreakRenderInput {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly count: number;
  readonly intensity: number;
  readonly tint: number;
  readonly directional: number | undefined;
  readonly index: number;
}

export function drawCarnageStreak({
  graphics,
  count,
  intensity,
  tint,
  directional,
  index,
}: CarnageStreakRenderInput): void {
  const angle = directional !== undefined && index < Math.ceil(count * 0.65)
    ? directional + (Math.random() - 0.5) * 1.25
    : Math.random() * Math.PI * 2;
  const start = 5 + Math.random() * 5;
  const end = start + (18 + Math.random() * 38) * intensity;
  graphics.lineStyle((1.2 + Math.random() * 2.8) * Math.min(intensity, 1.5), tint, 0.72 + Math.random() * 0.2).beginPath();
  graphics.moveTo(Math.cos(angle) * start, Math.sin(angle) * start);
  graphics.lineTo(Math.cos(angle) * end, Math.sin(angle) * end);
  graphics.strokePath().fillStyle(tint, 0.72).fillCircle(Math.cos(angle) * (end + 2 + Math.random() * 6), Math.sin(angle) * (end + 2 + Math.random() * 6), 1.5 + Math.random() * 2.5);
}

export function screenAngle(worldX: number, worldY: number, worldAngle: number): number {
  const origin = worldToScreen(worldX, worldY);
  const endpoint = worldToScreen(worldX + Math.cos(worldAngle), worldY + Math.sin(worldAngle));
  return Math.atan2(endpoint.y - origin.y, endpoint.x - origin.x);
}
