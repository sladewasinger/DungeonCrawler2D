// Shared "island chunk" framing math (2.5D-rotation LANE W3, editor rotation): both the
// connectivity gallery (`?scene=autotile-gallery`) and the paint-panel editor
// (`?scene=editor`) render a single NxN island living at real world [0, gridSize) x
// [0, gridSize) — but a 90/180/270 rotation moves that same real region into different
// (sometimes negative) VIEW coordinates (worldToView at 90 puts it at view y in
// (-gridSize, 0], for instance), so a chunk hard-anchored at view (0, 0) is only ever
// correct at orientation 0. LANE W1 built this once, inline, for the gallery only,
// picking exactly one CHUNK_SIZE-square chunk from the island's min corner
// (docs/ASSUMPTIONS.md row 259) — this pass found that a single chunk genuinely cannot
// always cover the island: with CHUNK_SIZE=32 and gridSize=20, the rotated bounding box
// straddles a chunk boundary at 90/180/270 (e.g. orientation 90's Y-span [-19, 0] needs
// chunk -1 for rows -19..-1 AND chunk 0 for row 0 — no single 32-wide aligned window
// contains both). `islandChunkCoords` (plural) returns every chunk actually needed —
// still exactly ONE at orientation 0 (preserving the pixel-lock gate byte-for-byte),
// 1-4 at the other 3.
import { CHUNK_SIZE } from "@dc2d/engine";
import type { ViewOrientation } from "../view/viewOrientation.js";
import { worldTileToView, worldToView, type Point } from "../view/viewTransform.js";

export interface ChunkCoord {
  readonly cx: number;
  readonly cy: number;
}

/** Every CHUNK_SIZE-aligned chunk index touched by the closed interval [min, max]. */
function axisChunkIndices(min: number, max: number): number[] {
  const lo = Math.floor(min / CHUNK_SIZE);
  const hi = Math.floor(max / CHUNK_SIZE);
  const indices: number[] = [];
  for (let i = lo; i <= hi; i++) indices.push(i);
  return indices;
}

/** Every VIEW chunk (buildChunkVisual's cx, cy) needed to fully cover the island's 4
 * real corners at `orientation` — exactly one at orientation 0 (the pixel-lock anchor),
 * up to 4 otherwise. Callers must build every entry, not just the first. */
export function islandChunkCoords(orientation: ViewOrientation, gridSize: number): ChunkCoord[] {
  const far = gridSize - 1;
  const corners = [
    { x: 0, y: 0 },
    { x: far, y: 0 },
    { x: 0, y: far },
    { x: far, y: far },
  ].map((c) => worldTileToView(c, orientation));
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const cxs = axisChunkIndices(Math.min(...xs), Math.max(...xs));
  const cys = axisChunkIndices(Math.min(...ys), Math.max(...ys));
  const coords: ChunkCoord[] = [];
  for (const cy of cys) for (const cx of cxs) coords.push({ cx, cy });
  return coords;
}

/** The island's rotated centroid, in VIEW-space tile units — the camera must center
 * here (not the fixed real-world center) since the island itself moves under rotation. */
export function islandViewCentroid(orientation: ViewOrientation, gridSize: number): Point {
  const centroidTiles = gridSize / 2;
  return worldToView({ x: centroidTiles, y: centroidTiles }, orientation);
}
