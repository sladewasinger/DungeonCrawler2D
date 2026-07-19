// Shared helpers for landmark stamping: local-coordinate footprint
// iteration anchored on the chunk's own corridor-junction point (reusing
// terrain.ts's jittered chunkCenter purely as a stable anchor — the room
// layout itself doesn't otherwise use it), with the existing corridor
// network (corridorCarved) always winning: a landmark never walls it off.

import { chunkCenter } from "../../terrain.js";
import { CHUNK_SIZE } from "../../types.js";

export interface LandmarkCenter {
  lx: number;
  ly: number;
}

/** The landmark's anchor: this chunk's own corridor-junction point, in local coords. */
export function landmarkCenter(worldSeed: number, floor: number, cx: number, cy: number): LandmarkCenter {
  const junction = chunkCenter(worldSeed, floor, cx, cy);
  return { lx: junction.x - cx * CHUNK_SIZE, ly: junction.y - cy * CHUNK_SIZE };
}

/** Visit every in-bounds local tile within `reach` (chebyshev) of the landmark center. */
export function forEachLandmarkTile(
  center: LandmarkCenter,
  reach: number,
  visit: (lx: number, ly: number, dx: number, dy: number) => void,
): void {
  const loY0 = Math.floor(center.ly - reach);
  const loY1 = Math.ceil(center.ly + reach);
  const loX0 = Math.floor(center.lx - reach);
  const loX1 = Math.ceil(center.lx + reach);
  for (let ly = loY0; ly <= loY1; ly++) {
    for (let lx = loX0; lx <= loX1; lx++) {
      if (lx < 0 || ly < 0 || lx >= CHUNK_SIZE || ly >= CHUNK_SIZE) continue;
      visit(lx, ly, lx - center.lx, ly - center.ly);
    }
  }
}

/** True where the room/corridor network already runs — a landmark never walls it off. */
export function onCorridor(corridorCarved: Uint8Array, chunkSize: number, lx: number, ly: number): boolean {
  return corridorCarved[ly * chunkSize + lx] === 1;
}
