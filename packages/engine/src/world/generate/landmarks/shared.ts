// Shared helpers for landmark stamping: local-coordinate footprint
// iteration anchored on the chunk's own corridor-junction point (reusing
// terrain.ts's jittered chunkCenter purely as a stable anchor — the room
// layout itself doesn't otherwise use it), with the existing corridor
// network (corridorCarved) always winning: a landmark never walls it off.

import { generatedChunkCenter } from "../../terrain.js";
import { GENERATION_CHUNK_SIZE as CHUNK_SIZE } from "../scale.js";

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

/** The landmark's anchor: this chunk's own corridor-junction point, in local coords. */
export function landmarkCenter({ worldSeed, floor, cx, cy }: LandmarkLocation): LandmarkCenter {
  const junction = generatedChunkCenter(worldSeed, floor, cx, cy);
  return { lx: junction.x - cx * CHUNK_SIZE, ly: junction.y - cy * CHUNK_SIZE };
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
