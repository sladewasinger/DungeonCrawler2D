// Unified height-derived faces for WALKABLE surfaces: any raised floor (terrace,
// dais — "every surface is a floor at any z") casts stacked brick face rows onto
// the lower cells south of it, depth-tinted, capped at 3 rows then swallowed by
// dark. Wall-tile faces stay in drawWallTile; this covers everything else.
import { TILE } from "@dc2d/engine";
import { FACE_MIN_DROP, type TerrainRead } from "./faces.js";

export const MAX_FACE_ROWS = 3;

export interface GroundFaceRow {
  /** 1 = directly under the edge (brightest), MAX_FACE_ROWS = deepest drawn row. */
  readonly rowIndex: number;
  /** Height of the raised source surface this face belongs to. */
  readonly sourceHeight: number;
  /** True when this is the final drawn row of a deeper-than-max drop (fades out). */
  readonly truncated: boolean;
}

/**
 * The face row this LOWER cell should draw for a raised walkable surface to its
 * north, or null. Row k means the source is k cells north; every cell between
 * must be at (or below) this cell's height, so ledges only cast onto ground
 * that actually sits at their foot.
 */
export function groundFaceRowAt(world: TerrainRead, wx: number, wy: number): GroundFaceRow | null {
  const myHeight = world.heightAt(wx, wy);
  if (world.tileAt(wx, wy) === TILE.Wall) return null;
  for (let k = 1; k <= MAX_FACE_ROWS; k++) {
    const sourceY = wy - k;
    if (world.tileAt(wx, sourceY) === TILE.Wall) return null;
    const sourceHeight = world.heightAt(wx, sourceY);
    const drop = sourceHeight - myHeight;
    if (drop >= FACE_MIN_DROP) {
      // Found the raised source k cells north. Its face is round(drop) rows
      // tall (capped); this cell draws row k of it — or nothing if the face
      // doesn't reach this far south.
      const rawRows = Math.round(drop);
      if (k > Math.min(rawRows, MAX_FACE_ROWS)) return null;
      return { rowIndex: k, sourceHeight, truncated: k === MAX_FACE_ROWS && rawRows > MAX_FACE_ROWS };
    }
    // Anything higher than this cell that is NOT a face source ends the column.
    if (sourceHeight > myHeight + 0.01) return null;
  }
  return null;
}

/** A raised walkable cell whose south neighbor is lower draws the cap-dash line on its own south edge. */
export function hasSouthCapDash(world: TerrainRead, wx: number, wy: number): boolean {
  if (world.tileAt(wx, wy) === TILE.Wall || world.tileAt(wx, wy + 1) === TILE.Wall) return false;
  return world.heightAt(wx, wy) - world.heightAt(wx, wy + 1) >= FACE_MIN_DROP;
}
