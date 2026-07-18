// Hard-edged drawing primitives (no anti-aliasing) shared by the gap-fill sprite generators.
import { opaque } from '../color.mjs';

/** Even-odd scanline fill of a closed polygon; produces crisp, non-anti-aliased edges. */
export function fillPolygon(canvas, points, hex) {
  const rgba = opaque(hex);
  const ys = points.map((p) => p[1]);
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(canvas.height - 1, Math.ceil(Math.max(...ys)));
  for (let y = minY; y <= maxY; y++) {
    const scanY = y + 0.5;
    const xs = [];
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      if ((y1 <= scanY && y2 > scanY) || (y2 <= scanY && y1 > scanY)) {
        xs.push(x1 + ((scanY - y1) / (y2 - y1)) * (x2 - x1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const startX = Math.round(xs[i]);
      const endX = Math.round(xs[i + 1]);
      for (let x = startX; x < endX; x++) canvas.setPixel(x, y, rgba);
    }
  }
}

/** Bresenham line with a square `thickness`x`thickness` stamp at every step. */
export function drawThickLine(canvas, x0, y0, x1, y1, thickness, hex) {
  const rgba = opaque(hex);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  const half = Math.floor(thickness / 2);
  while (true) {
    for (let oy = -half; oy < thickness - half; oy++) {
      for (let ox = -half; ox < thickness - half; ox++) canvas.setPixel(x + ox, y + oy, rgba);
    }
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

/** Trace a 1px silhouette outline in `hex` on every transparent pixel 4-adjacent to an opaque one. */
export function addOutline(canvas, hex) {
  const rgba = opaque(hex);
  const toSet = [];
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (canvas.getPixel(x, y)[3] !== 0) continue;
      const touchesOpaque = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ].some(([nx, ny]) => canvas.getPixel(nx, ny)[3] !== 0);
      if (touchesOpaque) toSet.push([x, y]);
    }
  }
  for (const [x, y] of toSet) canvas.setPixel(x, y, rgba);
}
