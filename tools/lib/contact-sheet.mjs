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
  drawText(sheet, {
    text: cell.name,
    x: cell.x,
    y: cell.y + cell.canvas.height + 2,
    rgba: LABEL_COLOR,
    scale: LABEL_SCALE,
  });
}

export function buildContactSheet(generatedSprites, comparisonSprites) {
  const generated = scaleSprites(generatedSprites);
  const originals = scaleSprites(comparisonSprites);
  const layout = layoutSections(generated, originals);
  const sheet = new Canvas(MAX_WIDTH, layout.bottom + PADDING);
  paintSheet(sheet, layout);
  return sheet;
}

function scaleSprites(sprites) {
  return sprites.map((sprite) => ({ name: sprite.name, canvas: scaleCanvas(sprite.canvas, SCALE) }));
}

function layoutSections(generated, originals) {
  const headerH = 12;
  const topY = PADDING;
  const { placed: generatedPlaced, bottom: afterGenerated } = layoutGrid(generated, topY + headerH);
  const originalsHeaderY = afterGenerated + 8;
  const { placed: originalsPlaced, bottom: afterOriginals } = layoutGrid(originals, originalsHeaderY + headerH);
  return { generatedPlaced, originalsPlaced, topY, originalsHeaderY, bottom: afterOriginals };
}

function paintSheet(sheet, layout) {
  sheet.fillRect(0, 0, sheet.width, sheet.height, BG);
  drawText(sheet, {
    text: 'GENERATED SPRITES (4X) - GAP FILL FOR 0X72 PACK',
    x: PADDING,
    y: layout.topY,
    rgba: HEADER_COLOR,
    scale: 2,
  });
  for (const cell of layout.generatedPlaced) paintCell(sheet, cell);
  drawText(sheet, {
    text: 'ORIGINAL PACK FRAMES (4X) - PALETTE COMPARISON',
    x: PADDING,
    y: layout.originalsHeaderY,
    rgba: HEADER_COLOR,
    scale: 2,
  });
  for (const cell of layout.originalsPlaced) paintCell(sheet, cell);
}
