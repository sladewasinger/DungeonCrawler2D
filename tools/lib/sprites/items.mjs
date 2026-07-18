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
  fillPolygon(c, [[3,5],[10,4],[13,6],[12,9],[10,8],[9,12],[7,9],[5,12],[3,9]], p.BONE_LIGHT);
  drawThickLine(c, 4, 6, 11, 7, 1, p.BONE_SHADOW);
  drawThickLine(c, 5, 9, 10, 10, 1, p.BONE_SHADOW);
  fillPolygon(c, [[9,9],[12,9],[10,12],[8,10]], p.CLOTH_MID);
  addOutline(c, p.OUTLINE);
  return c;
}

export function drawItemStick(p) {
  const c = blank();
  drawThickLine(c, 3, 13, 12, 4, 2, p.WOOD_MID);
  drawThickLine(c, 4, 13, 13, 4, 1, p.WOOD_DARK);
  drawThickLine(c, 8, 9, 10, 7, 1, p.WOOD_MID);
  addOutline(c, p.OUTLINE);
  return c;
}

export function drawItemBandage(p) {
  const c = blank();
  fillPolygon(c, [[4,4],[8,4],[9,6],[8,8],[4,8],[3,6]], p.WHITE_HILITE);
  drawThickLine(c, 4, 5, 7, 4, 1, p.BONE_SHADOW);
  drawThickLine(c, 4, 7, 8, 6, 1, p.BONE_SHADOW);
  drawThickLine(c, 8, 7, 13, 12, 1, p.WHITE_HILITE);
  drawThickLine(c, 9, 8, 13, 11, 1, p.BONE_SHADOW);
  addOutline(c, p.OUTLINE);
  return c;
}

export function drawItemRawMeat(p) {
  const c = blank();
  // Drumstick silhouette: rounded meat mass tapering onto a pale bone shaft with a flared tip.
  const shadowRed = mixColor(p.MEAT_RED, '#000000', 0.35);
  fillPolygon(c, [[4,3],[9,2],[12,4],[12,7],[10,9],[7,9],[4,7]], p.MEAT_RED);
  fillPolygon(c, [[9,7],[12,7],[11,9],[8,9]], shadowRed);
  c.setPixel(6, 4, opaque(p.WHITE_HILITE));
  drawThickLine(c, 8, 9, 8, 12, 2, p.WHITE_HILITE);
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
  fillPolygon(c, [[8,2],[11,6],[9,9],[6,9],[5,6]], p.TORCH_FLAME_MID);
  fillPolygon(c, [[8,3],[10,6],[8,8],[6,6]], p.TORCH_FLAME_OUTER);
  fillPolygon(c, [[8,5],[9,7],[7,7]], p.TORCH_FLAME_BRIGHT);
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
