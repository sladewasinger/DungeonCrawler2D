// Hand-authored 16x16 item icons filling the 5 item gaps from assets/INVENTORY.md GAPS#6.
import { Canvas } from '../png-canvas.mjs';
import { fillPolygon, drawThickLine, addOutline } from './shapes.mjs';
import { mixColor, opaque } from '../color.mjs';

function blank() {
  return new Canvas(16, 16);
}

export function drawItemRag(p) {
  const c = blank();
  // Flat folded square of cloth, torn notches along the bottom edge, crease lines + one
  // shadowed folded corner (same beige family as the base so it reads as fabric, not a stain).
  fillPolygon({ canvas: c, points: [[3,5],[10,4],[13,6],[12,9],[10,8],[9,12],[7,9],[5,12],[3,9]], hex: p.BONE_LIGHT });
  drawThickLine({ canvas: c, x0: 4, y0: 6, x1: 11, y1: 7, thickness: 1, hex: p.BONE_SHADOW });
  drawThickLine({ canvas: c, x0: 5, y0: 9, x1: 10, y1: 10, thickness: 1, hex: p.BONE_SHADOW });
  fillPolygon({ canvas: c, points: [[9,9],[12,9],[10,12],[8,10]], hex: p.CLOTH_MID });
  addOutline(c, p.OUTLINE);
  return c;
}

export function drawItemStick(p) {
  const c = blank();
  drawThickLine({ canvas: c, x0: 3, y0: 13, x1: 12, y1: 4, thickness: 2, hex: p.WOOD_MID });
  drawThickLine({ canvas: c, x0: 4, y0: 13, x1: 13, y1: 4, thickness: 1, hex: p.WOOD_DARK });
  drawThickLine({ canvas: c, x0: 8, y0: 9, x1: 10, y1: 7, thickness: 1, hex: p.WOOD_MID });
  addOutline(c, p.OUTLINE);
  return c;
}

export function drawItemBandage(p) {
  const c = blank();
  fillPolygon({ canvas: c, points: [[4,4],[8,4],[9,6],[8,8],[4,8],[3,6]], hex: p.WHITE_HILITE });
  drawThickLine({ canvas: c, x0: 4, y0: 5, x1: 7, y1: 4, thickness: 1, hex: p.BONE_SHADOW });
  drawThickLine({ canvas: c, x0: 4, y0: 7, x1: 8, y1: 6, thickness: 1, hex: p.BONE_SHADOW });
  drawThickLine({ canvas: c, x0: 8, y0: 7, x1: 13, y1: 12, thickness: 1, hex: p.WHITE_HILITE });
  drawThickLine({ canvas: c, x0: 9, y0: 8, x1: 13, y1: 11, thickness: 1, hex: p.BONE_SHADOW });
  addOutline(c, p.OUTLINE);
  return c;
}

export function drawItemRawMeat(p) {
  const c = blank();
  // Drumstick silhouette: rounded meat mass tapering onto a pale bone shaft with a flared tip.
  const shadowRed = mixColor(p.MEAT_RED, '#000000', 0.35);
  fillPolygon({ canvas: c, points: [[4,3],[9,2],[12,4],[12,7],[10,9],[7,9],[4,7]], hex: p.MEAT_RED });
  fillPolygon({ canvas: c, points: [[9,7],[12,7],[11,9],[8,9]], hex: shadowRed });
  c.setPixel(6, 4, opaque(p.WHITE_HILITE));
  drawThickLine({ canvas: c, x0: 8, y0: 9, x1: 8, y1: 12, thickness: 2, hex: p.WHITE_HILITE });
  c.setPixel(9, 10, opaque(p.BONE_SHADOW));
  c.setPixel(9, 11, opaque(p.BONE_SHADOW));
  c.fillRect(6, 12, 5, 2, opaque(p.WHITE_HILITE));
  c.fillRect(6, 13, 5, 1, opaque(p.BONE_SHADOW));
  addOutline(c, p.OUTLINE);
  return c;
}

export function drawItemTorch(p) {
  const c = blank();
  c.fillRect(7, 9, 2, 6, opaque(p.WOOD_MID));
  for (let y = 9; y < 15; y++) c.setPixel(8, y, opaque(p.WOOD_DARK));
  c.fillRect(7, 9, 2, 1, opaque(p.WOOD_DARK));
  fillPolygon({ canvas: c, points: [[8,2],[11,6],[9,9],[6,9],[5,6]], hex: p.TORCH_FLAME_MID });
  fillPolygon({ canvas: c, points: [[8,3],[10,6],[8,8],[6,6]], hex: p.TORCH_FLAME_OUTER });
  fillPolygon({ canvas: c, points: [[8,5],[9,7],[7,7]], hex: p.TORCH_FLAME_BRIGHT });
  addOutline(c, p.OUTLINE);
  return c;
}

export function generateItemIcons(palette) {
  return [
    { name: 'item_rag', canvas: drawItemRag(palette) },
    { name: 'item_stick', canvas: drawItemStick(palette) },
    { name: 'item_bandage', canvas: drawItemBandage(palette) },
    { name: 'item_raw_meat', canvas: drawItemRawMeat(palette) },
    { name: 'item_torch', canvas: drawItemTorch(palette) },
  ];
}
