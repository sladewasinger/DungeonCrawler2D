// Shared helpers for landmark stamping. The existing corridor network
// (corridorCarved) always wins: a landmark never walls it off.

import { CHUNK_SIZE } from "../../core/types.js";
import { landmarkAnchor } from "../layout/placement.js";

export interface LandmarkCenter {
  lx: number;
  ly: number;
}

export interface LandmarkLocation {
  worldSeed: number;
  floor: number;
  cx: number;
  cy: number;
}

export interface LandmarkStamp extends LandmarkLocation {
  seed: number;
  corridorCarved: Uint8Array;
  tiles: Uint8Array;
  height: Float32Array;
}

/** Clamp a landmark center so its complete square footprint stays in-chunk. */
export function clampLandmarkCenter(
  center: LandmarkCenter,
  radius: number,
): LandmarkCenter {
  const clamp = (value: number) =>
    Math.max(radius, Math.min(CHUNK_SIZE - 1 - radius, value));
  return { lx: clamp(center.lx), ly: clamp(center.ly) };
}

/** Stable landmark center with its complete footprint kept in this chunk. */
export function landmarkCenter(
  location: LandmarkLocation,
  radius: number,
): LandmarkCenter {
  const anchor = landmarkAnchor(location);
  return clampLandmarkCenter({ lx: anchor.x, ly: anchor.y }, radius);
}

/** Visit every in-bounds local tile within `reach` (chebyshev) of the landmark center. */
export function forEachLandmarkTile(
  center: LandmarkCenter,
  reach: number,
  visit: (input: { lx: number; ly: number; dx: number; dy: number }) => void,
): void {
  const loY0 = Math.floor(center.ly - reach);
  const loY1 = Math.ceil(center.ly + reach);
  const loX0 = Math.floor(center.lx - reach);
  const loX1 = Math.ceil(center.lx + reach);
  for (let ly = loY0; ly <= loY1; ly++) for (let lx = loX0; lx <= loX1; lx++) visitLandmarkTile({ center, visit, lx, ly });
}

function visitLandmarkTile({ center, visit, lx, ly }: { center: LandmarkCenter; visit: (input: { lx: number; ly: number; dx: number; dy: number }) => void; lx: number; ly: number }): void {
  if (lx >= 0 && ly >= 0 && lx < CHUNK_SIZE && ly < CHUNK_SIZE) visit({ lx, ly, dx: lx - center.lx, dy: ly - center.ly });
}

/** True where the room/corridor network already runs — a landmark never walls it off. */
export function onCorridor({ corridorCarved, chunkSize, lx, ly }: { corridorCarved: Uint8Array; chunkSize: number; lx: number; ly: number }): boolean {
  return corridorCarved[ly * chunkSize + lx] === 1;
}
