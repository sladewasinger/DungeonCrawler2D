// Pit interior faces: a dig below the base plane shows its north wall INSIDE
// the hole — the rows a raised surface doesn't own (ownFace.ts's base-plane
// split) continue southward into the pit cells. A 0 -> -1 edge keeps the flat
// ground flat and draws one brick row inside the pit's northmost cell; a
// 1 -> -1 edge draws one row on the z1 tile and one more continuing down.
import { TILE, WALL_FACE_MIN_DROP } from "@dc2d/engine";
import type { TerrainRead } from "./faces.js";
import { faceRunPiece, faceSplit, MAX_FACE_ROWS, type FaceRunPiece } from "./ownFace.js";

export interface PitFaceRow {
  /** 1 = the wall's top row overall, continuing the numbering from any rows on the raised side. */
  readonly rowFromTop: number;
  /** Height of the upper surface this wall descends from. */
  readonly surfaceHeight: number;
  /** True when the real drop exceeds MAX_FACE_ROWS and this is the deepest drawn row (fades into the hole). */
  readonly truncated: boolean;
}

/**
 * The interior north-wall row this BELOW-BASE cell renders instead of its
 * floor/hole art, or null for deeper pit cells that keep their dark floor.
 * The pit cell at distance d south of the edge draws row rowsOnRaised + d.
 */
export function pitFaceRowAt(world: TerrainRead, wx: number, wy: number): PitFaceRow | null {
  const floorHeight = world.heightAt(wx, wy);
  if (floorHeight >= 0) return null;
  for (let d = 1; d <= MAX_FACE_ROWS; d++) {
    const northHeight = world.heightAt(wx, wy - d);
    const rise = northHeight - floorHeight;
    if (rise >= WALL_FACE_MIN_DROP) {
      const { totalRows, rowsOnRaised, rawRows } = faceSplit(northHeight, floorHeight);
      const rowFromTop = rowsOnRaised + d;
      if (rowFromTop > totalRows) return null;
      return {
        rowFromTop,
        surfaceHeight: northHeight,
        truncated: rowFromTop === MAX_FACE_ROWS && rawRows > MAX_FACE_ROWS,
      };
    }
    // Same pit floor continues north — keep scanning only while it stays level.
    if (Math.abs(northHeight - floorHeight) > 0.01) return null;
  }
  return null;
}

/**
 * Run-aware brick piece for a pit face cell — same shapes and closure rules
 * as raised runs, EXCEPT a side closure (the thin `wall_edge_mid_*` mortar
 * line) only draws when that side's non-connecting neighbor is a real WALL.
 * Where it's open ground instead, the surrounding ground tile's own
 * topEdgesAt already draws that exact seam from its side (its `east`/`west`
 * flag) — drawing it again here would double the rim's outline
 * (VISUAL_DIRECTION.md: "pit rims carry ONE outline"). A wall neighbor never
 * runs topEdgesAt (drawWallTile owns wall cells, not drawGroundTile), so
 * there the closure here is the ONLY line and must stay.
 */
export function pitRunPieceAt(world: TerrainRead, wx: number, wy: number): FaceRunPiece {
  const piece = faceRunPiece(
    pitFaceRowAt(world, wx - 1, wy) !== null,
    pitFaceRowAt(world, wx + 1, wy) !== null,
  );
  return {
    frame: piece.frame,
    closeWest: piece.closeWest && world.tileAt(wx - 1, wy) === TILE.Wall,
    closeEast: piece.closeEast && world.tileAt(wx + 1, wy) === TILE.Wall,
  };
}
