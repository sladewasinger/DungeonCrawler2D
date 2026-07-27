import Phaser from "phaser";
import { worldToScreen } from "../../render/entities/geometry/worldToScreen.js";
import { decalAlpha, isDecalExpired } from "../blood/bloodDecalMotion.js";
import { recycleSlotIndex, shouldGrowPool } from "../blood/bloodDecalSlots.js";
import { loadCarnageSettings } from "../system/carnageSettings.js";
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

export interface DeathCarnageInput {
  readonly x: number;
  readonly y: number;
  readonly groundHeight: number;
  readonly tint: number;
  readonly appearance: CarnageAppearance;
  readonly nowMs: number;
  readonly impactAngle?: number | undefined;
  readonly spritePrefix?: string | undefined;
}

interface MarkPlacement {
  readonly mark: CarnageMark;
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  readonly nowMs: number;
}

export class DeathCarnagePool {
  private readonly marks: CarnageMark[] = [];
  private cursor = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  spawn(input: DeathCarnageInput): void {
    const settings = loadCarnageSettings();
    if (!settings.enabled) return;
    const mark = shouldGrowPool(this.marks.length, CARNAGE_POOL_CAP)
      ? this.grow()
      : this.recycle();
    const screen = worldToScreen(input.x, input.y);
    const placement = groundedVisualPlacement({ rawScreenY: screen.y, groundHeight: input.groundHeight, layer: "corpseFragment" });
    this.drawMark({ mark, input, settings, screen, placement });
    this.placeMark({ mark, x: screen.x, y: placement.projectedScreenY, depth: placement.depth, nowMs: input.nowMs });
  }

  private drawMark({ mark, input, settings, screen, placement }: {
    readonly mark: CarnageMark;
    readonly input: DeathCarnageInput;
    readonly settings: ReturnType<typeof loadCarnageSettings>;
    readonly screen: { x: number; y: number };
    readonly placement: ReturnType<typeof groundedVisualPlacement>;
  }): void {
    mark.graphics.clear();
    if (settings.bloodEnabled && !isSkeletalDefId(input.appearance.defId)) {
      drawCarnageStreaks({
        graphics: mark.graphics,
        count: settings.streakLimit,
        intensity: settings.intensity,
        tint: input.tint,
        world: { x: input.x, y: input.y },
        impactAngle: input.impactAngle,
      });
    }
    this.drawChunks({ mark, input, settings, screen, placement });
  }

  private drawChunks({ mark, input, settings, screen, placement }: {
    readonly mark: CarnageMark;
    readonly input: DeathCarnageInput;
    readonly settings: ReturnType<typeof loadCarnageSettings>;
    readonly screen: { x: number; y: number };
    readonly placement: ReturnType<typeof groundedVisualPlacement>;
  }): void {
    drawCarnageChunks({ scene: this.scene, mark, count: settings.chunkLimit, intensity: settings.intensity, appearance: input.appearance, screen: { x: screen.x, y: placement.projectedScreenY }, spritePrefix: input.spritePrefix });
  }

  private placeMark({ mark, x, y, depth, nowMs }: MarkPlacement): void {
    const graphics = mark.graphics;
    graphics
      .setPosition(x, y)
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
