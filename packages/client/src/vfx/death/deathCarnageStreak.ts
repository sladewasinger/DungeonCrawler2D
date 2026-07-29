import type Phaser from "phaser";
import { worldToScreen } from "../../render/entities/geometry/worldToScreen.js";
import { groundEffectRow, splitGroundSegmentByRow, type GroundPlanePoint } from "./groundPlaneDepth.js";

export interface CarnageStreakRenderInput {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly count: number;
  readonly intensity: number;
  readonly tint: number;
  readonly directional: number | undefined;
  readonly index: number;
}

export interface CarnageStreakRowRenderInput extends Omit<CarnageStreakRenderInput, "graphics"> {
  readonly graphicsForRow: (row: number) => Phaser.GameObjects.Graphics;
  readonly rawScreenY: number;
}

interface StreakGeometryInput {
  readonly count: number;
  readonly intensity: number;
  readonly directional: number | undefined;
  readonly index: number;
}

interface StreakLineInput {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly start: GroundPlanePoint;
  readonly end: GroundPlanePoint;
  readonly width: number;
  readonly alpha: number;
  readonly tint: number;
}

interface CarnageStreakGeometry {
  readonly start: GroundPlanePoint;
  readonly end: GroundPlanePoint;
  readonly splat: GroundPlanePoint;
  readonly splatRadius: number;
  readonly width: number;
  readonly alpha: number;
}

export function drawCarnageStreak({
  graphics,
  count,
  intensity,
  tint,
  directional,
  index,
}: CarnageStreakRenderInput): void {
  drawStreakGeometry(graphics, createStreakGeometry({ count, intensity, directional, index }), tint);
}

export function drawCarnageStreakByRows({
  graphicsForRow,
  rawScreenY,
  count,
  intensity,
  tint,
  directional,
  index,
}: CarnageStreakRowRenderInput): void {
  const geometry = createStreakGeometry({ count, intensity, directional, index });
  for (const piece of splitGroundSegmentByRow({ rawScreenY, start: geometry.start, end: geometry.end })) {
    drawStreakLine({ graphics: graphicsForRow(piece.row), start: piece.start, end: piece.end, width: geometry.width, alpha: geometry.alpha, tint });
  }
  const splatRow = groundEffectRow(rawScreenY + geometry.splat.y);
  graphicsForRow(splatRow)
    .fillStyle(tint, 0.72)
    .fillCircle(geometry.splat.x, geometry.splat.y, geometry.splatRadius);
}

function createStreakGeometry({ count, intensity, directional, index }: StreakGeometryInput): CarnageStreakGeometry {
  const angle = directional !== undefined && index < Math.ceil(count * 0.65)
    ? directional + (Math.random() - 0.5) * 1.25
    : Math.random() * Math.PI * 2;
  const startDistance = 5 + Math.random() * 5;
  const endDistance = startDistance + (18 + Math.random() * 38) * intensity;
  return {
    start: polarPoint(angle, startDistance),
    end: polarPoint(angle, endDistance),
    splat: polarPoint(angle, endDistance + 2 + Math.random() * 6),
    splatRadius: 1.5 + Math.random() * 2.5,
    width: (1.2 + Math.random() * 2.8) * Math.min(intensity, 1.5),
    alpha: 0.72 + Math.random() * 0.2,
  };
}

function polarPoint(angle: number, distance: number): GroundPlanePoint {
  return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
}

function drawStreakGeometry(graphics: Phaser.GameObjects.Graphics, geometry: CarnageStreakGeometry, tint: number): void {
  drawStreakLine({ graphics, start: geometry.start, end: geometry.end, width: geometry.width, alpha: geometry.alpha, tint });
  graphics.fillStyle(tint, 0.72).fillCircle(geometry.splat.x, geometry.splat.y, geometry.splatRadius);
}

function drawStreakLine({ graphics, start, end, width, alpha, tint }: StreakLineInput): void {
  graphics.lineStyle(width, tint, alpha).beginPath();
  graphics.moveTo(start.x, start.y);
  graphics.lineTo(end.x, end.y);
  graphics.strokePath();
}

export function screenAngle(worldX: number, worldY: number, worldAngle: number): number {
  const origin = worldToScreen(worldX, worldY);
  const endpoint = worldToScreen(worldX + Math.cos(worldAngle), worldY + Math.sin(worldAngle));
  return Math.atan2(endpoint.y - origin.y, endpoint.x - origin.x);
}
