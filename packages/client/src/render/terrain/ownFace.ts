// The own-tile face model (user doctrine): the southernmost rows of a raised
// surface ARE its visible face — faces start where the height starts, never
// projected onto lower ground. A z1 wall tile is all face; a proper platform
// is two stacked tiles (south face, north top); doors sit IN the face row.
import { WALL_FACE_MIN_DROP } from "@dc2d/engine";
import type { TerrainRead } from "./faces.js";

export const MAX_FACE_ROWS = 3;

export interface OwnFaceRow {
  /** 1 = the face's top row (brightest), counting down toward the ground. */
  readonly rowFromTop: number;
  /** Tiles between this cell and the open lower ground south of it (1 = adjacent). */
  readonly distanceToGround: number;
  /** Height of the surface this face belongs to. */
  readonly surfaceHeight: number;
  /** True when the real drop exceeds MAX_FACE_ROWS and this is the last drawn row. */
  readonly truncated: boolean;
}

/**
 * The face row this RAISED cell renders instead of its top art, or null when it
 * is interior enough to stay a walkable top / rim. Works identically for rock
 * masses and raised floors — the face is a height phenomenon.
 */
export function ownFaceRowAt(world: TerrainRead, wx: number, wy: number): OwnFaceRow | null {
  const surfaceHeight = world.heightAt(wx, wy);
  for (let d = 1; d <= MAX_FACE_ROWS; d++) {
    const southHeight = world.heightAt(wx, wy + d);
    const drop = surfaceHeight - southHeight;
    if (drop >= WALL_FACE_MIN_DROP) {
      const rawRows = Math.round(drop);
      const rows = Math.min(rawRows, MAX_FACE_ROWS);
      if (d > rows) return null;
      return {
        rowFromTop: rows - d + 1,
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

/** True when a walkable top cell should draw the pack's cap-dash line on its south edge (its south neighbor is a face row). */
export function hasCapDashSouth(world: TerrainRead, wx: number, wy: number): boolean {
  if (ownFaceRowAt(world, wx, wy) !== null) return false;
  return ownFaceRowAt(world, wx, wy + 1) !== null && world.heightAt(wx, wy + 1) >= world.heightAt(wx, wy) - 0.01;
}
