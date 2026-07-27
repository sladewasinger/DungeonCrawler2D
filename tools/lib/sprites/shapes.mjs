// Hard-edged drawing primitives (no anti-aliasing) shared by the gap-fill sprite generators.
import { opaque } from '../color.mjs';

/** Even-odd scanline fill of a closed polygon; produces crisp, non-anti-aliased edges. */
function intersectionsAt(points, scanY) {
  const xs = [];
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    const crossesScanline = (y1 <= scanY && y2 > scanY) || (y2 <= scanY && y1 > scanY);
    if (crossesScanline) xs.push(x1 + ((scanY - y1) / (y2 - y1)) * (x2 - x1));
  }
  return xs.sort((a, b) => a - b);
}

function fillSpans({ canvas, xs, y, rgba }) {
  for (let i = 0; i + 1 < xs.length; i += 2) {
    const startX = Math.round(xs[i]);
    const endX = Math.round(xs[i + 1]);
    for (let x = startX; x < endX; x++) canvas.setPixel(x, y, rgba);
  }
}

export function fillPolygon({ canvas, points, hex }) {
  const rgba = opaque(hex);
  const ys = points.map((p) => p[1]);
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(canvas.height - 1, Math.ceil(Math.max(...ys)));
  for (let y = minY; y <= maxY; y++) {
    fillSpans({ canvas, xs: intersectionsAt(points, y + 0.5), y, rgba });
  }
}

/** Bresenham line with a square `thickness`x`thickness` stamp at every step. */
function stamp({ canvas, x, y, thickness, half, rgba }) {
  for (let oy = -half; oy < thickness - half; oy++) {
    for (let ox = -half; ox < thickness - half; ox++) canvas.setPixel(x + ox, y + oy, rgba);
  }
}

function nextBresenhamPoint(state) {
  const next = { ...state };
  const e2 = 2 * next.err;
  if (e2 >= next.dy) {
    next.err += next.dy;
    next.x += next.sx;
  }
  if (e2 <= next.dx) {
    next.err += next.dx;
    next.y += next.sy;
  }
  return next;
}

export function drawThickLine({ canvas, x0, y0, x1, y1, thickness, hex }) {
  const state = {
    dx: Math.abs(x1 - x0), dy: -Math.abs(y1 - y0),
    sx: x0 < x1 ? 1 : -1, sy: y0 < y1 ? 1 : -1,
    err: Math.abs(x1 - x0) - Math.abs(y1 - y0), x: x0, y: y0,
  };
  const rgba = opaque(hex);
  const half = Math.floor(thickness / 2);
  while (!isEndpoint(state, x1, y1)) {
    stamp({ canvas, x: state.x, y: state.y, thickness, half, rgba });
    Object.assign(state, nextBresenhamPoint(state));
  }
  stamp({ canvas, x: state.x, y: state.y, thickness, half, rgba });
}

function isEndpoint(state, x, y) {
  return state.x === x && state.y === y;
}

/** Trace a 1px silhouette outline in `hex` on every transparent pixel 4-adjacent to an opaque one. */
function hasOpaqueNeighbor(canvas, x, y) {
  return [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
    .some(([nx, ny]) => canvas.getPixel(nx, ny)[3] !== 0);
}

export function addOutline(canvas, hex) {
  const rgba = opaque(hex);
  const toSet = [];
  for (let index = 0; index < canvas.width * canvas.height; index++) {
    const x = index % canvas.width;
    const y = Math.floor(index / canvas.width);
    if (canvas.getPixel(x, y)[3] === 0 && hasOpaqueNeighbor(canvas, x, y)) toSet.push([x, y]);
  }
  for (const [x, y] of toSet) canvas.setPixel(x, y, rgba);
}
