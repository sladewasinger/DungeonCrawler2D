// Debug-tileset tile picks for the production terrain renderer. Floors/stairs are a
// straight lookup; walls run autotile.ts's pure bitmask solver against 2D map-space
// material adjacency (same-height finite-floor equality) — the SAME solid-neighbor test regardless
// of whether the caller is a plain wall cell, a raised face row, or a pit-interior
// face row, per the decree: "the border logic applies in 2D map-space (material
// adjacency), not per-row."
import { solveWallAutotile, type SolidAt, type WallAutotile } from "./autotile.js";
import { FRAME_FLOOR, FRAME_STAIRS_EW, FRAME_STAIRS_NS, wallFrameFor } from "./debugTileset.js";
import { isVoidCellAt, type TerrainRead } from "./faces.js";
import { stacksVertically } from "./stairTread.js";

/** Always the flat gray floor frame — the debug tileset has exactly one floor variant. */
export function pickFloorFrame(): number {
  return FRAME_FLOOR;
}

/** Horizontal lines for a north/south climb, vertical lines for east/west (user's own spec). */
export function pickStairFrame(direction: number): number {
  return stacksVertically(direction) ? FRAME_STAIRS_NS : FRAME_STAIRS_EW;
}

/** The `solid` probe for derived wall-material adjacency at the same finite height. */
export function wallSolidAt(world: TerrainRead, wx: number, wy: number): SolidAt {
  const height = world.heightAt(wx, wy);
  const hasRaisedSurface = Math.abs(height) >= 0.01;
  return (dx, dy) => hasRaisedSurface && !isVoidCellAt(world, wx + dx, wy + dy) &&
    Math.abs(world.heightAt(wx + dx, wy + dy)) >= 0.01 &&
    Math.abs(world.heightAt(wx + dx, wy + dy) - height) < 0.01;
}

/** Full autotile solve (mask8/mask4/edges/corners) for the wall material at (wx, wy). */
export function wallAutotileAt(world: TerrainRead, wx: number, wy: number): WallAutotile {
  return solveWallAutotile(wallSolidAt(world, wx, wy));
}

/** The debug tileset's baked border frame for a wall cell's cardinal mask. */
export function pickWallFrame(mask4: number): number {
  return wallFrameFor(mask4);
}
