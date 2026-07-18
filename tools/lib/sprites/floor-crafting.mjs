// Fills INVENTORY.md GAPS#5 (sanctuary floor) and GAPS#8 (crafting table).
import { Canvas } from '../png-canvas.mjs';
import { drawThickLine, addOutline } from './shapes.mjs';
import { scaleColor, opaque } from '../color.mjs';

/** Recolors floor_1 toward the doc's sanctuary teal, kept dark/desaturated (scaled, not raw accent). */
export function drawFloorSanctuary(sheet, palette) {
  const c = Canvas.fromRegion(sheet, 16, 64, 16, 16); // floor_1
  const tealDark = scaleColor(palette.SANCTUARY_TEAL, 0.35);
  const tealMid = scaleColor(palette.SANCTUARY_TEAL, 0.55);
  const remap = new Map([
    [palette.FLOOR_BASE, opaque(tealDark)],
    [palette.FLOOR_MID, opaque(tealMid)],
  ]);
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const [r, g, b, a] = c.getPixel(x, y);
      if (a === 0) continue;
      const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
      const replacement = remap.get(hex);
      if (replacement) c.setPixel(x, y, replacement);
    }
  }
  return c;
}

/** A 16x16 workbench: wood tabletop + legs (crate/door tones) with a hammer sitting on top. */
export function drawCraftingTable(p) {
  const c = new Canvas(16, 16);
  c.fillRect(3, 12, 2, 3, opaque(p.WOOD_DARK));
  c.fillRect(11, 12, 2, 3, opaque(p.WOOD_DARK));
  c.fillRect(2, 9, 12, 3, opaque(p.WOOD_MID));
  c.fillRect(2, 9, 12, 1, opaque(p.WOOD_HILITE));
  drawThickLine(c, 8, 9, 8, 4, 1, p.WOOD_DARK);
  c.fillRect(6, 3, 5, 3, opaque(p.OUTLINE));
  c.fillRect(6, 3, 5, 1, opaque(p.WHITE_HILITE));
  addOutline(c, p.OUTLINE);
  return c;
}

export function generateFloorAndCrafting(sheet, palette) {
  return [
    { name: 'floor_sanctuary', canvas: drawFloorSanctuary(sheet, palette) },
    { name: 'crafting_table', canvas: drawCraftingTable(palette) },
  ];
}
