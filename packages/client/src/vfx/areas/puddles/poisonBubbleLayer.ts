import type Phaser from "phaser";
import { getViewOrientation } from "../../../render/view/transform/viewState.js";
import type { AreaTileView } from "../areaEffectPool.js";
import type { AreaVisualBudget } from "../presentation/areaVisualBudget.js";
import { areaVisualDepthsForRow } from "../presentation/areaVisualDepth.js";
import { areaSurfaceRow } from "../presentation/areaSurface.js";
import { AREA_POISON_BUBBLES } from "../presentation/areaVisualStyle.js";
import { puddleLayerSignature } from "./puddleLayerSignature.js";
import {
  createPoisonBubbleFrame,
  createPoisonBubbleSamples,
  updatePoisonBubbleFrame,
  type PoisonBubbleFrame,
  type PoisonBubbleSample,
} from "./poisonBubbleMotion.js";

interface BubbleRow {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly frame: PoisonBubbleFrame;
  samples: readonly PoisonBubbleSample[];
  signature: string;
}

export class PoisonBubbleLayer {
  private readonly activeRows = new Map<number, BubbleRow>();
  private readonly rows = new Map<number, AreaTileView[]>();
  private readonly seenRows = new Set<number>();
  private readonly spareRows: Phaser.GameObjects.Graphics[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly budget: AreaVisualBudget,
  ) {}

  sync(tiles: readonly AreaTileView[]): void {
    this.collectRows(tiles);
    this.seenRows.clear();
    const rowBudget = Math.max(
      1,
      Math.floor(this.budget.maximumPoisonBubbles / Math.max(1, this.rows.size)),
    );
    for (const [row, rowTiles] of this.rows) {
      this.syncRow(row, rowTiles, rowBudget);
    }
    this.releaseUnseenRows();
  }

  private collectRows(tiles: readonly AreaTileView[]): void {
    this.rows.clear();
    for (const tile of tiles) {
      if (tile.sprite !== "poison") continue;
      const row = areaSurfaceRow(tile);
      const rowTiles = this.rows.get(row) ?? [];
      rowTiles.push(tile);
      this.rows.set(row, rowTiles);
    }
  }

  private syncRow(
    row: number,
    tiles: readonly AreaTileView[],
    maximum: number,
  ): void {
    this.seenRows.add(row);
    const bubbleRow = this.activeRows.get(row) ?? this.createRow(row);
    const signature = `${puddleLayerSignature(
      tiles,
      "poison",
      getViewOrientation(),
    )}:${maximum}`;
    if (signature !== bubbleRow.signature) {
      bubbleRow.signature = signature;
      bubbleRow.samples = createPoisonBubbleSamples(tiles, maximum);
    }
    drawBubbleRow(bubbleRow, this.scene.time.now);
  }

  private createRow(row: number): BubbleRow {
    const graphics = this.spareRows.pop() ?? this.scene.add.graphics();
    graphics
      .setName("area-poison-bubbles")
      .setDepth(
        areaVisualDepthsForRow(row).liquid + AREA_POISON_BUBBLES.depthBias,
      )
      .setVisible(true);
    const bubbleRow = {
      graphics,
      frame: createPoisonBubbleFrame(),
      samples: [],
      signature: "",
    };
    this.activeRows.set(row, bubbleRow);
    return bubbleRow;
  }

  private releaseUnseenRows(): void {
    for (const [row, bubbleRow] of this.activeRows) {
      if (this.seenRows.has(row)) continue;
      this.activeRows.delete(row);
      bubbleRow.graphics.clear().setVisible(false);
      if (this.spareRows.length < AREA_POISON_BUBBLES.maximumSpareRows) {
        this.spareRows.push(bubbleRow.graphics);
      } else bubbleRow.graphics.destroy();
    }
  }

  dispose(): void {
    for (const row of this.activeRows.values()) row.graphics.destroy();
    for (const graphics of this.spareRows) graphics.destroy();
    this.activeRows.clear();
    this.spareRows.length = 0;
    this.rows.clear();
    this.seenRows.clear();
  }
}

function drawBubbleRow(row: BubbleRow, nowMs: number): void {
  row.graphics.clear();
  for (const sample of row.samples) {
    updatePoisonBubbleFrame(row.frame, sample, nowMs);
    drawBubble(row.graphics, sample.x, row.frame);
  }
}

function drawBubble(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  frame: ReturnType<typeof createPoisonBubbleFrame>,
): void {
  graphics
    .fillStyle(
      AREA_POISON_BUBBLES.color,
      AREA_POISON_BUBBLES.fillAlpha * frame.alpha,
    )
    .fillEllipse(x, frame.y, frame.radiusX * 2, frame.radiusY * 2)
    .lineStyle(
      AREA_POISON_BUBBLES.lineWidthPx,
      AREA_POISON_BUBBLES.color,
      AREA_POISON_BUBBLES.ringAlpha * frame.alpha,
    )
    .strokeEllipse(x, frame.y, frame.radiusX * 2, frame.radiusY * 2);
}
