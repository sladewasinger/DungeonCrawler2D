// The own-tile face model (user doctrine): the southernmost rows of a raised
// surface ARE its visible face — faces start where the height starts, never
// projected onto lower ground. A surface only owns as many rows as it rises
// above the base plane (z0); a drop continuing below z0 renders its remaining
// rows INSIDE the pit (pitFace.ts), so flat z0 ground beside a dig stays flat.
import { WALL_FACE_MIN_DROP } from "@dc2d/engine";
import type { TerrainRead } from "./faces.js";

export const MAX_FACE_ROWS = 3;

/** How an edge's face rows split at the base plane: raised-cell rows vs rows continuing into the pit below. */
export interface FaceSplit {
  /** Rows actually drawn, clipped to MAX_FACE_ROWS. */
  readonly totalRows: number;
  /** Of those, how many sit on the raised cells; the rest continue south into pit cells. */
  readonly rowsOnRaised: number;
  /** Unclipped row count — larger than totalRows when the drop is deeper than MAX_FACE_ROWS. */
  readonly rawRows: number;
}

/** Splits a north(high)/south(low) edge's face rows at the base plane. */
export function faceSplit(northHeight: number, southHeight: number): FaceSplit {
  const rawRows = Math.round(northHeight - southHeight);
  const totalRows = Math.min(rawRows, MAX_FACE_ROWS);
  const rowsOnRaised = Math.min(Math.max(Math.round(northHeight), 0), totalRows);
  return { totalRows, rowsOnRaised, rawRows };
}

export interface OwnFaceRow {
  /** 1 = the face's top row (brightest), counting down toward the ground. */
  readonly rowFromTop: number;
  /** Tiles between this cell and the open lower ground south of it (1 = adjacent). */
  readonly distanceToGround: number;
  /** Height of the surface this face belongs to. */
  readonly surfaceHeight: number;
  /** True when the real drop exceeds MAX_FACE_ROWS and this is the clipped far row. */
  readonly truncated: boolean;
}

/**
 * The face row this RAISED cell renders instead of its top art, or null when it
 * is interior enough to stay a walkable top / rim. Works identically for rock
 * masses and raised floors — the face is a height phenomenon. Cells at or below
 * the base plane never own face rows (rowsOnRaised is 0 there).
 */
export function ownFaceRowAt(world: TerrainRead, wx: number, wy: number): OwnFaceRow | null {
  const surfaceHeight = world.heightAt(wx, wy);
  for (let d = 1; d <= MAX_FACE_ROWS; d++) {
    const southHeight = world.heightAt(wx, wy + d);
    const drop = surfaceHeight - southHeight;
    if (drop >= WALL_FACE_MIN_DROP) {
      const { rowsOnRaised, rawRows } = faceSplit(surfaceHeight, southHeight);
      if (d > rowsOnRaised) return null;
      return {
        rowFromTop: rowsOnRaised - d + 1,
        distanceToGround: d,
        surfaceHeight,
        truncated: d === MAX_FACE_ROWS && rawRows > MAX_FACE_ROWS,
      };
    }
    // A south neighbor at (or above) this height is the same surface (or an
    // interior step) — keep scanning only while it stays level with us.
    if (Math.abs(southHeight - surfaceHeight) > 0.01) return null;
  }
  return null;
}

/** The atlas piece a face row's own tile draws, plus which side(s) still need the thin closure line. */
export interface FaceRunPiece {
  readonly frame: "wall_left" | "wall_mid" | "wall_right";
  readonly closeWest: boolean;
  readonly closeEast: boolean;
}

/**
 * Pure run-piece choice from per-side connectivity. A run END picks the
 * wall_left/wall_right frame whose built-in mortar border closes that side; an
 * isolated column (neither side connects) also closes both with the thin lines.
 */
export function faceRunPiece(westConnects: boolean, eastConnects: boolean): FaceRunPiece {
  const frame = !westConnects ? "wall_left" : !eastConnects ? "wall_right" : "wall_mid";
  return { frame, closeWest: !westConnects, closeEast: !eastConnects };
}

/**
 * Run-aware brick piece for a RAISED face cell. A neighbor counts as connected
 * only when it is ALSO a face row at this exact row — a neighbor at the same
 * height whose own drop lands a row further south (a ramp delaying it) renders
 * non-brick art here, so the run still needs its border against it.
 */
export function faceRunPieceAt(world: TerrainRead, wx: number, wy: number): FaceRunPiece {
  return faceRunPiece(ownFaceRowAt(world, wx - 1, wy) !== null, ownFaceRowAt(world, wx + 1, wy) !== null);
}
