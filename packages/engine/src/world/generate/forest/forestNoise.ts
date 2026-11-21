import { hash2DFloat, mixSeeds } from "../../../core/rng.js";
import type { FloorBounds, FloorBuffers, FloorPoint, FloorRect, GeneratedFeatureStamp } from "../finiteFloorTypes.js";

export interface NoiseSampleInput {
  readonly seed: number;
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

export interface ProtectedAreaCheck {
  readonly point: FloorPoint;
  readonly featureStamps: readonly GeneratedFeatureStamp[];
  readonly sealedArenas: readonly FloorRect[];
}

export function smoothNoise2D(input: NoiseSampleInput): number {
  const gx = input.x / input.scale;
  const gy = input.y / input.scale;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const fx = smoothStep(gx - ix);
  const fy = smoothStep(gy - iy);
  const n00 = hash2DFloat(input.seed, ix, iy);
  const n10 = hash2DFloat(input.seed, ix + 1, iy);
  const n01 = hash2DFloat(input.seed, ix, iy + 1);
  const n11 = hash2DFloat(input.seed, ix + 1, iy + 1);
  const top = lerp(n00, n10, fx);
  const bottom = lerp(n01, n11, fx);
  return lerp(top, bottom, fy);
}

export function fbmNoise2D(input: NoiseSampleInput): number {
  const primary = smoothNoise2D(input);
  const detail = smoothNoise2D({
    seed: mixSeeds(input.seed, 0x51f1),
    x: input.x,
    y: input.y,
    scale: Math.max(2, input.scale * 0.5),
  });
  return primary * 0.65 + detail * 0.35;
}

export function pointInRect(point: FloorPoint, rect: FloorRect, padding = 0): boolean {
  return point.x >= rect.x0 - padding
    && point.x <= rect.x1 + padding
    && point.y >= rect.y0 - padding
    && point.y <= rect.y1 + padding;
}

export function insideProtectedFeatureArea(check: ProtectedAreaCheck): boolean {
  const inStamp = check.featureStamps.some((stamp) => pointInRect(check.point, stamp.bounds, 1));
  if (inStamp) return true;
  return check.sealedArenas.some((arena) => pointInRect(check.point, arena, 1));
}

export function nearSpawn(point: FloorPoint, spawn: FloorPoint, radius: number): boolean {
  return Math.hypot(point.x - spawn.x, point.y - spawn.y) <= radius;
}

export function clampCoord(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function borderDistance(bounds: FloorBounds, point: FloorPoint): number {
  const dx = Math.min(point.x - bounds.minX, bounds.maxX - point.x);
  const dy = Math.min(point.y - bounds.minY, bounds.maxY - point.y);
  return Math.min(dx, dy);
}

export function hasOwnedRoomOrFeature(buffers: FloorBuffers, index: number): boolean {
  return (buffers.roomIds[index] ?? -1) >= 0
    || (buffers.roomWallIds[index] ?? -1) >= 0
    || (buffers.featureIds[index] ?? -1) >= 0;
}

function smoothStep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function buildRingOffsets(radius: number, includeCenter: boolean): readonly FloorPoint[] {
  const offsets: FloorPoint[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (includeCenter || dx !== 0 || dy !== 0) offsets.push({ x: dx, y: dy });
    }
  }
  return offsets;
}
