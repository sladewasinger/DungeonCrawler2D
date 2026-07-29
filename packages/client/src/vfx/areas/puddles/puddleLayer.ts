import Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../../boot/assetManifest.js";
import { getViewOrientation } from "../../../render/view/transform/viewState.js";
import type { AreaTileView } from "../areaEffectPool.js";
import { areaVisualDepthsForRow } from "../presentation/areaVisualDepth.js";
import {
  areaSurfaceRow,
  areaSurfaceScreen,
  projectAreaSurfaceNeighbor,
} from "../presentation/areaSurface.js";
import {
  MAXIMUM_SPARE_PUDDLE_ROWS,
  PUDDLE_CORNER_RADIUS_PX,
  PUDDLE_INSET_PX,
  PUDDLE_STYLES,
  type PuddleKind,
} from "../presentation/areaVisualStyle.js";
import { projectedNeighborMask } from "./projectedAreaTopology.js";
import { puddleRectFor } from "./puddleGeometry.js";
import { puddleLayerSignature } from "./puddleLayerSignature.js";

interface PuddleRow {
  readonly graphics: Phaser.GameObjects.Graphics;
  signature: string;
}

export class PuddleLayer {
  private readonly activeRows = new Map<number, PuddleRow>();
  private readonly spareRows: Phaser.GameObjects.Graphics[] = [];
  private readonly seenRows = new Set<number>();
  private readonly rows = new Map<number, AreaTileView[]>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly kind: PuddleKind,
  ) {}

  sync(tiles: readonly AreaTileView[]): void {
    const orientation = getViewOrientation();
    this.collectRows(tiles);
    this.syncRows(orientation);
    this.releaseUnseenRows();
  }

  private collectRows(tiles: readonly AreaTileView[]): void {
    this.rows.clear();
    for (const tile of tiles) {
      if (tile.sprite !== this.kind) continue;
      const row = areaSurfaceRow(tile);
      const rowTiles = this.rows.get(row) ?? [];
      rowTiles.push(tile);
      this.rows.set(row, rowTiles);
    }
  }

  private syncRows(
    orientation: ReturnType<typeof getViewOrientation>,
  ): void {
    this.seenRows.clear();
    for (const [row, tiles] of this.rows) {
      this.syncRow(row, tiles, orientation);
    }
  }

  private syncRow(
    row: number,
    tiles: readonly AreaTileView[],
    orientation: ReturnType<typeof getViewOrientation>,
  ): void {
    this.seenRows.add(row);
    const puddleRow = this.activeRows.get(row) ?? this.createRow(row);
    const signature = puddleLayerSignature(tiles, this.kind, orientation);
    if (signature === puddleRow.signature) return;
    puddleRow.signature = signature;
    this.redraw(puddleRow.graphics, tiles);
  }

  private createRow(row: number): PuddleRow {
    const graphics = this.spareRows.pop() ?? this.createGraphics();
    graphics.setDepth(areaVisualDepthsForRow(row).liquid).setVisible(true);
    const puddleRow = { graphics, signature: "" };
    this.activeRows.set(row, puddleRow);
    return puddleRow;
  }

  private createGraphics(): Phaser.GameObjects.Graphics {
    const style = PUDDLE_STYLES[this.kind];
    return this.scene.add.graphics()
      .setName(`area-puddle-${this.kind}`)
      .setAlpha(style.alpha)
      .setBlendMode(Phaser.BlendModes[style.blendMode]);
  }

  private redraw(
    graphics: Phaser.GameObjects.Graphics,
    tiles: readonly AreaTileView[],
  ): void {
    const style = PUDDLE_STYLES[this.kind];
    graphics.clear().fillStyle(style.color, 1);
    for (const tile of tiles) drawPuddleTile(graphics, tile);
  }

  private releaseUnseenRows(): void {
    for (const [row, puddleRow] of this.activeRows) {
      if (this.seenRows.has(row)) continue;
      this.releaseRow(row, puddleRow);
    }
  }

  private releaseRow(row: number, puddleRow: PuddleRow): void {
    this.activeRows.delete(row);
    puddleRow.graphics.clear().setVisible(false);
    if (this.spareRows.length >= MAXIMUM_SPARE_PUDDLE_ROWS) {
      puddleRow.graphics.destroy();
      return;
    }
    this.spareRows.push(puddleRow.graphics);
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

function drawPuddleTile(
  graphics: Phaser.GameObjects.Graphics,
  tile: AreaTileView,
): void {
  const center = areaSurfaceScreen(tile);
  const neighborMask = projectedNeighborMask({
    x: tile.x,
    y: tile.y,
    neighborMask: tile.neighborMask,
    project: (x, y) => projectAreaSurfaceNeighbor(tile, x, y),
  });
  const rect = puddleRectFor({
    tile: { ...center, neighborMask },
    tileSize: SCREEN_TILE_PX,
    inset: PUDDLE_INSET_PX,
    radius: PUDDLE_CORNER_RADIUS_PX,
  });
  graphics.fillRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    rect.radius,
  );
}
