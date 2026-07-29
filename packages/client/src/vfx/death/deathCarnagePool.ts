import Phaser from "phaser";
import { worldToScreen } from "../../render/entities/geometry/worldToScreen.js";
import { recycleSlotIndex, shouldGrowPool } from "../blood/bloodDecalSlots.js";
import { loadCarnageSettings } from "../system/carnageSettings.js";
import { isSkeletalDefId } from "./boneChipBurst.js";
import {
  drawCarnageChunks,
  drawCarnageStreaks,
  type CarnageAppearance,
  type CarnageMark,
} from "./deathCarnageDrawing.js";
import { depthForGroundEffect } from "../../render/entities/presentation/depthSort.js";
import { groundedVisualPlacement, groundEffectRow } from "./groundPlaneDepth.js";
import {
  carnageGraphicsForRow,
  clearCarnageRows,
  createCarnageMark,
  destroyCarnageRows,
  placeCarnageRows,
  updateCarnageMark,
} from "./ground/deathCarnageRows.js";

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
    this.placeMark({ mark, x: screen.x, y: placement.projectedScreenY, nowMs: input.nowMs });
  }

  private drawMark({ mark, input, settings, screen, placement }: {
    readonly mark: CarnageMark;
    readonly input: DeathCarnageInput;
    readonly settings: ReturnType<typeof loadCarnageSettings>;
    readonly screen: { x: number; y: number };
    readonly placement: ReturnType<typeof groundedVisualPlacement>;
  }): void {
    clearCarnageRows(mark);
    const graphicsForRow = (row: number) => carnageGraphicsForRow(this.scene, mark, row);
    if (settings.bloodEnabled && !isSkeletalDefId(input.appearance.defId)) {
      drawCarnageStreaks({
        graphicsForRow,
        count: settings.streakLimit,
        intensity: settings.intensity,
        tint: input.tint,
        world: { x: input.x, y: input.y },
        impactAngle: input.impactAngle,
        rawScreenY: screen.y,
      });
    }
    this.drawChunks({ mark, input, settings, screen, placement, graphicsForRow });
  }

  private drawChunks({ mark, input, settings, screen, placement, graphicsForRow }: {
    readonly mark: CarnageMark;
    readonly input: DeathCarnageInput;
    readonly settings: ReturnType<typeof loadCarnageSettings>;
    readonly screen: { x: number; y: number };
    readonly placement: ReturnType<typeof groundedVisualPlacement>;
    readonly graphicsForRow: (row: number) => Phaser.GameObjects.Graphics;
  }): void {
    drawCarnageChunks({
      scene: this.scene,
      mark,
      count: settings.chunkLimit,
      intensity: settings.intensity,
      appearance: input.appearance,
      screen: { x: screen.x, y: placement.projectedScreenY },
      rawScreenY: screen.y,
      graphicsForRow,
      onFragmentPlaced: (fragment, rawY) => fragment.setDepth(depthForGroundEffect(groundEffectRow(rawY)) + GROUND_FRAGMENT_BIAS),
      spritePrefix: input.spritePrefix,
    });
  }

  private placeMark({ mark, x, y, nowMs }: {
    readonly mark: CarnageMark;
    readonly x: number;
    readonly y: number;
    readonly nowMs: number;
  }): void {
    placeCarnageRows({ mark, x, y, alpha: BASE_ALPHA });
    mark.spawnMs = nowMs;
  }

  update(nowMs: number): void {
    for (const mark of this.marks) updateCarnageMark(mark, nowMs, BASE_ALPHA);
  }

  dispose(): void {
    for (const mark of this.marks) {
      destroyCarnageRows(mark);
      for (const fragment of mark.fragments) fragment.destroy();
    }
    this.marks.length = 0;
    this.cursor = 0;
  }

  private grow(): CarnageMark {
    const mark = createCarnageMark(this.scene);
    this.marks.push(mark);
    return mark;
  }

  private recycle(): CarnageMark {
    const index = recycleSlotIndex(this.cursor, CARNAGE_POOL_CAP);
    this.cursor++;
    return this.marks[index]!;
  }

}
