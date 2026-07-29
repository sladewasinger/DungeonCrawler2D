// Post-pass overlays drawn on top of the base tile fill: chunk-border
// hairlines, stair climb-direction glyphs, and the legend strip.

import { entryClimbDir } from "../../packages/engine/src/world/stairs.js";
import { CHUNK_SIZE, TILE } from "../../packages/engine/src/world/types.js";
import type { Canvas } from "./canvas.js";
import type { ChunkCache } from "./chunk-cache.js";
import { GLYPH_DARK, LEGEND, type Rgb } from "./colors.js";
import { drawText } from "./font.js";

const HAIRLINE: Rgb = { r: 10, g: 10, b: 15 };

export function drawChunkHairlines({ canvas, chunks, tilePx, mapPx }: {
  canvas: Canvas;
  chunks: number;
  tilePx: number;
  mapPx: number;
}): void {
  for (let c = 0; c <= chunks; c++) {
    const at = c * CHUNK_SIZE * tilePx;
    canvas.fillRect(at, 0, 1, mapPx, HAIRLINE);
    canvas.fillRect(0, at, mapPx, 1, HAIRLINE);
  }
}

/** Marks pointing toward the uphill side of every stair tile, per entryClimbDir's direction 0..3 = N/E/S/W. */
const CLIMB_MARK_OFFSETS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [[2, 0], [3, 0], [2, 1], [3, 1]], // north
  [[4, 2], [5, 2], [4, 3], [5, 3]], // east
  [[2, 4], [3, 4], [2, 5], [3, 5]], // south
  [[0, 2], [1, 2], [0, 3], [1, 3]], // west
];

function drawStairTile({ canvas, cache, wx, wy, tilePx }: {
  canvas: Canvas;
  cache: ChunkCache;
  wx: number;
  wy: number;
  tilePx: number;
}): void {
  if (cache.tileAt(wx, wy) !== TILE.Stairs) return;
  const dir = entryClimbDir(cache, wx, wy);
  const offsets = dir === null ? undefined : CLIMB_MARK_OFFSETS[dir];
  if (!offsets) return;
  const px = wx * tilePx;
  const py = wy * tilePx;
  for (const [dx, dy] of offsets) canvas.fillRect(px + dx, py + dy, 1, 1, GLYPH_DARK);
}

export function drawStairGlyphs({ canvas, cache, chunks, tilePx }: {
  canvas: Canvas;
  cache: ChunkCache;
  chunks: number;
  tilePx: number;
}): void {
  const span = chunks * CHUNK_SIZE;
  for (let wy = 0; wy < span; wy++) {
    for (let wx = 0; wx < span; wx++) drawStairTile({ canvas, cache, wx, wy, tilePx });
  }
}

const LEGEND_TEXT: Rgb = { r: 214, g: 214, b: 224 };
const SWATCH = 10;
const GLYPH_SCALE = 1;

export function drawLegend({ canvas, top, panelWidth }: {
  canvas: Canvas;
  top: number;
  panelWidth: number;
}): void {
  canvas.fillRect(0, top, panelWidth, canvas.height - top, { r: 26, g: 26, b: 36 });
  let x = 12;
  const y = top + (canvas.height - top - SWATCH) / 2;
  for (const entry of LEGEND) {
    canvas.fillRect(x, y, SWATCH, SWATCH, entry.color);
    drawText({
      canvas, x: x + SWATCH + 4, y: y + 2, text: entry.label,
      color: LEGEND_TEXT, scale: GLYPH_SCALE,
    });
    x += SWATCH + 4 + (entry.label.length + 1) * (4 * GLYPH_SCALE) + 16;
  }
}
