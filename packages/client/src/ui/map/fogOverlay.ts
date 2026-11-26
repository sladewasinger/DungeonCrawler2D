/** Cached offscreen dark-parchment Fog-of-War mask & persistent landmark markers for [M] Overworld Map [REQ-P9-02]. */
import {
  FOG_CELL_TILES, SANCTUARY_CENTER, isFogCellRevealed,
  type FogState,
} from "@dc2d/engine";

const FOG_INK = "rgba(15, 19, 28, 0.92)";

export interface FogRenderViewport {
  readonly fog: FogState;
  readonly fogVersion: number;
  readonly worldSeed: number;
  readonly tx0: number;
  readonly ty0: number;
  readonly localX: number;
  readonly localY: number;
  readonly zoom: number;
  readonly mapPx: number;
}

export class FogMapOverlay {
  private readonly buffer: HTMLCanvasElement;
  private cacheKey = "";

  constructor(sizePx = 480) {
    this.buffer = document.createElement("canvas");
    this.buffer.width = sizePx;
    this.buffer.height = sizePx;
  }

  private refreshBuffer(v: FogRenderViewport): void {
    const ctx = this.buffer.getContext("2d");
    if (!ctx) return;
    const { mapPx, zoom, localX, localY, fog } = v;
    ctx.clearRect(0, 0, mapPx, mapPx);
    ctx.fillStyle = FOG_INK;
    const halfTiles = mapPx / (2 * zoom);
    const minCellX = Math.floor((localX - halfTiles) / FOG_CELL_TILES) - 1;
    const maxCellX = Math.floor((localX + halfTiles) / FOG_CELL_TILES) + 1;
    const minCellY = Math.floor((localY - halfTiles) / FOG_CELL_TILES) - 1;
    const maxCellY = Math.floor((localY + halfTiles) / FOG_CELL_TILES) + 1;
    const cellPx = FOG_CELL_TILES * zoom;
    const center = mapPx * 0.5;

    for (let cy = minCellY; cy <= maxCellY; cy++) {
      const py = center + (cy * FOG_CELL_TILES - localY) * zoom;
      for (let cx = minCellX; cx <= maxCellX; cx++) {
        if (isFogCellRevealed(fog, cx, cy)) continue;
        const px = center + (cx * FOG_CELL_TILES - localX) * zoom;
        ctx.fillRect(Math.floor(px), Math.floor(py), Math.ceil(cellPx) + 1, Math.ceil(cellPx) + 1);
      }
    }
  }

  draw(targetCtx: CanvasRenderingContext2D, v: FogRenderViewport): void {
    const key = `${v.worldSeed}:${v.tx0}:${v.ty0}:${v.zoom}:${v.fogVersion}`;
    if (key !== this.cacheKey) {
      this.cacheKey = key;
      this.refreshBuffer(v);
    }
    targetCtx.drawImage(this.buffer, 0, 0);
  }
}

export function drawShieldBadge(ctx: CanvasRenderingContext2D, opts: {
  readonly px: number; readonly py: number; readonly fill: string; readonly rim: string;
}): void {
  const { px, py, fill, rim } = opts;
  ctx.save();
  ctx.fillStyle = "#090d14";
  ctx.beginPath();
  ctx.moveTo(px, py - 6.5); ctx.lineTo(px + 5.5, py - 3.5);
  ctx.lineTo(px + 4.5, py + 2.5); ctx.lineTo(px, py + 6.5);
  ctx.lineTo(px - 4.5, py + 2.5); ctx.lineTo(px - 5.5, py - 3.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.strokeStyle = rim;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(px, py - 5); ctx.lineTo(px + 4, py - 2.6);
  ctx.lineTo(px + 3.2, py + 2); ctx.lineTo(px, py + 5);
  ctx.lineTo(px - 3.2, py + 2); ctx.lineTo(px - 4, py - 2.6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

const inMapBounds = (px: number, py: number, mapPx: number): boolean =>
  px >= -8 && py >= -8 && px <= mapPx + 8 && py <= mapPx + 8;

export function drawSanctuaryAndStairHints(opts: {
  readonly ctx: CanvasRenderingContext2D; readonly localX: number; readonly localY: number;
  readonly zoom: number; readonly mapPx: number;
}): void {
  const { ctx, localX, localY, zoom, mapPx } = opts;
  const c = mapPx * 0.5;
  const hubPx = c + (SANCTUARY_CENTER.x - localX) * zoom;
  const hubPy = c + (SANCTUARY_CENTER.y - localY) * zoom;
  if (inMapBounds(hubPx, hubPy, mapPx)) {
    drawShieldBadge(ctx, { px: hubPx, py: hubPy, fill: "#38bdf8", rim: "#e0f2fe" });
  }
  const stairPx = c + (-9.5 - localX) * zoom;
  const stairPy = c + (-7.0 - localY) * zoom;
  if (inMapBounds(stairPx, stairPy, mapPx)) {
    ctx.save();
    ctx.fillStyle = "#facc15";
    ctx.fillRect(Math.round(stairPx - 2), Math.round(stairPy - 2), 4, 4);
    ctx.restore();
  }
}
