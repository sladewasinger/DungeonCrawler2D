import Phaser from "phaser";
import { depthForGroundEffect } from "../../../render/entities/presentation/depthSort.js";
import { decalAlpha, isDecalExpired } from "../../blood/bloodDecalMotion.js";
import type { CarnageMark } from "../deathCarnageDrawing.js";

export function createCarnageMark(scene: Phaser.Scene): CarnageMark {
  const graphics = scene.add.graphics().setName("death-carnage-ground");
  return {
    graphics,
    rowGraphics: new Map([[0, graphics]]),
    fragments: [],
    spawnMs: -Infinity,
  };
}

export function clearCarnageRows(mark: CarnageMark): void {
  for (const graphics of mark.rowGraphics.values()) graphics.clear().setVisible(false);
}

export function carnageGraphicsForRow(scene: Phaser.Scene, mark: CarnageMark, row: number): Phaser.GameObjects.Graphics {
  const existing = mark.rowGraphics.get(row);
  if (existing) return existing.setVisible(true);
  const graphics = scene.add.graphics().setName(`death-carnage-ground-row-${row}`);
  mark.rowGraphics.set(row, graphics);
  return graphics.setVisible(true);
}

export function placeCarnageRows({ mark, x, y, alpha }: {
  readonly mark: CarnageMark;
  readonly x: number;
  readonly y: number;
  readonly alpha: number;
}): void {
  for (const [row, graphics] of mark.rowGraphics) {
    graphics.setPosition(x, y).setAlpha(alpha).setDepth(depthForGroundEffect(row));
  }
}

export function destroyCarnageRows(mark: CarnageMark): void {
  for (const graphics of mark.rowGraphics.values()) graphics.destroy();
}

export function updateCarnageMark(mark: CarnageMark, nowMs: number, baseAlpha: number): void {
  const elapsed = nowMs - mark.spawnMs;
  const alpha = decalAlpha(elapsed, baseAlpha);
  const visible = !isDecalExpired(elapsed);
  for (const graphics of mark.rowGraphics.values()) graphics.setAlpha(alpha).setVisible(visible && graphics.visible);
  for (const fragment of mark.fragments) fragment.setAlpha(alpha).setVisible(fragment.active && visible);
}
