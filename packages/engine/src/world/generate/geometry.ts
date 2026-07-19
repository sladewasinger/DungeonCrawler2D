// Pure rect/point math shared by the BSP split, corridor routing, and the
// height pass. Nothing here touches tiles/height arrays.

import type { Point, Rect } from "./types.js";

export function rectW(r: Rect): number {
  return r.x1 - r.x0 + 1;
}

export function rectH(r: Rect): number {
  return r.y1 - r.y0 + 1;
}

export function centerX(r: Rect): number {
  return Math.round((r.x0 + r.x1) / 2);
}

export function centerY(r: Rect): number {
  return Math.round((r.y0 + r.y1) / 2);
}

export function clampInt(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Chebyshev-ish taxicab distance from a point to the nearest cell of a rect (0 if inside). */
export function rectDistance(rect: Rect, p: Point): number {
  const dx = Math.max(rect.x0 - p.x, 0, p.x - rect.x1);
  const dy = Math.max(rect.y0 - p.y, 0, p.y - rect.y1);
  return dx + dy;
}

/** `w` tiles centered on `c`, clamped into [lo, hi]. */
export function band(c: number, w: number, lo: number, hi: number): { a: number; b: number } {
  const half0 = Math.floor((w - 1) / 2);
  const a = clampInt(c - half0, lo, hi);
  const b = clampInt(a + w - 1, lo, hi);
  return { a, b };
}

function hBand(y: number, xA: number, xB: number, w: number, size: number): Rect {
  const { a, b } = band(y, w, 0, size - 1);
  return { x0: Math.min(xA, xB), x1: Math.max(xA, xB), y0: a, y1: b };
}

function vBand(x: number, yA: number, yB: number, w: number, size: number): Rect {
  const { a, b } = band(x, w, 0, size - 1);
  return { y0: Math.min(yA, yB), y1: Math.max(yA, yB), x0: a, x1: b };
}

/**
 * Two rects forming an L-path from `a` to `b`, `w` tiles wide. `aVertical`
 * makes the first leg leave `a` along y (for a N/S-facing doorway) before
 * bending; otherwise it leaves along x (E/W-facing) — corridors exit a
 * threshold perpendicular to the wall, then bend toward the target.
 */
export function lPathLegs(a: Point, aVertical: boolean, b: Point, w: number, size: number): [Rect, Rect] {
  if (aVertical) {
    const bend: Point = { x: a.x, y: b.y };
    return [vBand(a.x, a.y, bend.y, w, size), hBand(bend.y, bend.x, b.x, w, size)];
  }
  const bend: Point = { x: b.x, y: a.y };
  return [hBand(a.y, a.x, bend.x, w, size), vBand(bend.x, bend.y, b.y, w, size)];
}
