// Builds contact-sheet.png: every generated sprite at 4x, labeled, plus a handful of
// original pack frames alongside for a quick eyeballed palette/style comparison.
import { Canvas } from './png-canvas.mjs';
import { drawText, textWidth } from './bitmap-font.mjs';
import { opaque } from './color.mjs';

const SCALE = 4;
const PADDING = 6;
const LABEL_SCALE = 1;
const LABEL_HEIGHT = 5 * LABEL_SCALE + 3;
const MAX_WIDTH = 920;
const BG = [26, 26, 36, 255]; // panel dark, matches docs/VISUAL_DIRECTION.md UI panel color
const LABEL_COLOR = opaque('#d3bfa9');
const HEADER_COLOR = opaque('#3dd6c3');

function scaleCanvas(src, scale) {
  const out = new Canvas(src.width * scale, src.height * scale);
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) out.fillRect(x * scale, y * scale, scale, scale, src.getPixel(x, y));
  }
  return out;
}

function layoutGrid(entries, startY) {
  let cursorX = PADDING;
  let cursorY = startY;
  let rowHeight = 0;
  const placed = [];
  for (const entry of entries) {
    const cellW = Math.max(entry.canvas.width, textWidth(entry.name, LABEL_SCALE)) + PADDING;
    const cellH = entry.canvas.height + LABEL_HEIGHT + PADDING;
    if (cursorX + cellW > MAX_WIDTH) {
      cursorX = PADDING;
      cursorY += rowHeight;
      rowHeight = 0;
    }
    placed.push({ ...entry, x: cursorX, y: cursorY });
    cursorX += cellW;
    rowHeight = Math.max(rowHeight, cellH);
  }
  return { placed, bottom: cursorY + rowHeight };
}

function paintCell(sheet, cell) {
  sheet.blit(cell.canvas, 0, 0, cell.x, cell.y, cell.canvas.width, cell.canvas.height);
  drawText(sheet, cell.name, cell.x, cell.y + cell.canvas.height + 2, LABEL_COLOR, LABEL_SCALE);
}

export function buildContactSheet(generatedSprites, comparisonSprites) {
  const generated = generatedSprites.map((s) => ({ name: s.name, canvas: scaleCanvas(s.canvas, SCALE) }));
  const originals = comparisonSprites.map((s) => ({ name: s.name, canvas: scaleCanvas(s.canvas, SCALE) }));

  const headerH = 12;
  const topY = PADDING;
  const { placed: generatedPlaced, bottom: afterGenerated } = layoutGrid(generated, topY + headerH);
  const originalsHeaderY = afterGenerated + 8;
  const { placed: originalsPlaced, bottom: afterOriginals } = layoutGrid(originals, originalsHeaderY + headerH);

  const sheet = new Canvas(MAX_WIDTH, afterOriginals + PADDING);
  sheet.fillRect(0, 0, sheet.width, sheet.height, BG);
  drawText(sheet, 'GENERATED SPRITES (4X) - GAP FILL FOR 0X72 PACK', PADDING, topY, HEADER_COLOR, 2);
  for (const cell of generatedPlaced) paintCell(sheet, cell);
  drawText(sheet, 'ORIGINAL PACK FRAMES (4X) - PALETTE COMPARISON', PADDING, originalsHeaderY, HEADER_COLOR, 2);
  for (const cell of originalsPlaced) paintCell(sheet, cell);
  return sheet;
}
