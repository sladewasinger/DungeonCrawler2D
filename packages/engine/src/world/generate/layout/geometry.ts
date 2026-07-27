// Pure rect/point math shared by the BSP split, corridor routing, and the
// height pass. Nothing here touches tiles/height arrays.

import type { Point, Rect } from "../types.js";

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
export interface BandRequest {
  center: number;
  width: number;
  min: number;
  max: number;
}

export function band(request: BandRequest): { a: number; b: number } {
  const half0 = Math.floor((request.width - 1) / 2);
  const a = clampInt(request.center - half0, request.min, request.max);
  const b = clampInt(a + request.width - 1, request.min, request.max);
  return { a, b };
}

interface PathBand {
  fixed: number;
  start: number;
  end: number;
  width: number;
  size: number;
}

function hBand(bandRequest: PathBand): Rect {
  const { a, b } = band({ center: bandRequest.fixed, width: bandRequest.width, min: 0, max: bandRequest.size - 1 });
  return { x0: Math.min(bandRequest.start, bandRequest.end), x1: Math.max(bandRequest.start, bandRequest.end), y0: a, y1: b };
}

function vBand(bandRequest: PathBand): Rect {
  const { a, b } = band({ center: bandRequest.fixed, width: bandRequest.width, min: 0, max: bandRequest.size - 1 });
  return { y0: Math.min(bandRequest.start, bandRequest.end), y1: Math.max(bandRequest.start, bandRequest.end), x0: a, x1: b };
}

/**
 * Two rects forming an L-path from `a` to `b`, `w` tiles wide. `aVertical`
 * makes the first leg leave `a` along y (for a N/S-facing doorway) before
 * bending; otherwise it leaves along x (E/W-facing) — corridors exit a
 * threshold perpendicular to the wall, then bend toward the target.
 */
export interface LPathRequest {
  from: Point;
  fromVertical: boolean;
  to: Point;
  width: number;
  size: number;
}

export function lPathLegs(request: LPathRequest): [Rect, Rect] {
  if (request.fromVertical) {
    const bend: Point = { x: request.from.x, y: request.to.y };
    return [
      vBand({ fixed: request.from.x, start: request.from.y, end: bend.y, width: request.width, size: request.size }),
      hBand({ fixed: bend.y, start: bend.x, end: request.to.x, width: request.width, size: request.size }),
    ];
  }
  const bend: Point = { x: request.to.x, y: request.from.y };
  return [
    hBand({ fixed: request.from.y, start: request.from.x, end: bend.x, width: request.width, size: request.size }),
    vBand({ fixed: bend.x, start: bend.y, end: request.to.y, width: request.width, size: request.size }),
  ];
}
