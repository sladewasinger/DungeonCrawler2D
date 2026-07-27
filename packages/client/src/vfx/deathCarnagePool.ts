import Phaser from "phaser";
import { worldToScreen } from "../render/entities/worldToScreen.js";
import { decalAlpha, isDecalExpired } from "./bloodDecalMotion.js";
import { recycleSlotIndex, shouldGrowPool } from "./bloodDecalSlots.js";
import { loadCarnageSettings } from "./carnageSettings.js";
import { isSkeletalDefId } from "./boneChipBurst.js";
import {
  drawCarnageChunks,
  drawCarnageStreaks,
  type CarnageAppearance,
  type CarnageMark,
} from "./deathCarnageDrawing.js";
import { groundedVisualPlacement } from "./groundPlaneDepth.js";

const CARNAGE_POOL_CAP = 24;
const BASE_ALPHA = 0.88;
const GROUND_FRAGMENT_BIAS = 0.01;
export type { CarnageAppearance } from "./deathCarnageDrawing.js";

export class DeathCarnagePool {
  private readonly marks: CarnageMark[] = [];
  private cursor = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  spawn(
    worldX: number,
    worldY: number,
    groundHeight: number,
    tint: number,
    appearance: CarnageAppearance,
    nowMs: number,
    impactAngle?: number,
    spritePrefix?: string,
  ): void {
    const settings = loadCarnageSettings();
    if (!settings.enabled) return;
    const mark = shouldGrowPool(this.marks.length, CARNAGE_POOL_CAP)
      ? this.grow()
      : this.recycle();
    const screen = worldToScreen(worldX, worldY);
    const placement = groundedVisualPlacement(screen.y, groundHeight, "corpseFragment");
    const graphics = mark.graphics;
    graphics.clear();
    if (settings.bloodEnabled && !isSkeletalDefId(appearance.defId)) {
      drawCarnageStreaks(
        graphics, settings.streakLimit, settings.intensity,
        tint, worldX, worldY, impactAngle,
      );
    }
    drawCarnageChunks(
      this.scene, mark, settings.chunkLimit, settings.intensity,
      appearance, screen.x, placement.projectedScreenY, spritePrefix,
    );
    this.placeMark(
      mark,
      screen.x,
      placement.projectedScreenY,
      placement.depth,
      nowMs,
    );
  }

  private placeMark(
    mark: CarnageMark,
    screenX: number,
    screenY: number,
    depth: number,
    nowMs: number,
  ): void {
    const graphics = mark.graphics;
    graphics
      .setPosition(screenX, screenY)
      .setAlpha(BASE_ALPHA)
      .setVisible(true)
      .setDepth(depth);
    // Keep fragments distinct from the streak graphics without entering the AO band.
    for (const fragment of mark.fragments) fragment.setDepth(depth + GROUND_FRAGMENT_BIAS);
    mark.spawnMs = nowMs;
  }

  update(nowMs: number): void {
    for (const mark of this.marks) {
      const elapsed = nowMs - mark.spawnMs;
      mark.graphics
        .setAlpha(decalAlpha(elapsed, BASE_ALPHA))
        .setVisible(!isDecalExpired(elapsed));
      for (const fragment of mark.fragments) {
        fragment
          .setAlpha(decalAlpha(elapsed, BASE_ALPHA))
          .setVisible(fragment.active && !isDecalExpired(elapsed));
      }
    }
  }

  dispose(): void {
    for (const mark of this.marks) {
      mark.graphics.destroy();
      for (const fragment of mark.fragments) fragment.destroy();
    }
    this.marks.length = 0;
    this.cursor = 0;
  }

  private grow(): CarnageMark {
    const mark = {
      graphics: this.scene.add.graphics().setName("death-carnage-ground"),
      fragments: [],
      spawnMs: -Infinity,
    };
    this.marks.push(mark);
    return mark;
  }

  private recycle(): CarnageMark {
    const index = recycleSlotIndex(this.cursor, CARNAGE_POOL_CAP);
    this.cursor++;
    return this.marks[index]!;
  }
}
