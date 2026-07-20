// Worldgen's output layer: mechanically converts today's generator output
// ({tiles, height}, still produced by generate/index.ts exactly as before —
// this pivot does not touch that tuned pipeline) into the authored stack
// form, so the byte-identical round-trip invariant
// (generate/stacksRoundtrip.test.ts) can be asserted against 25+ seeds. Not
// a design tool: a real cap value is a floor-variant id the art/editor lane
// picks, which this mechanical layer has no way to know — every generated
// Floor tile gets the same DEFAULT_FLOOR_CAP placeholder.

import { entryClimbDir, type StairView } from "../stairs.js";
import { TILE, type TileType } from "../types.js";
import { DEFAULT_FLOOR_CAP, TILE_FEATURE, type StackDir, type StackTile } from "./types.js";

function stairView(tiles: Uint8Array, height: Float32Array, width: number, rows: number): StairView {
  const at = (arr: Uint8Array | Float32Array, x: number, y: number, fallback: number): number => {
    if (x < 0 || y < 0 || x >= width || y >= rows) return fallback;
    return arr[y * width + x] ?? fallback;
  };
  return {
    tileAt: (x, y) => at(tiles, x, y, TILE.Wall),
    heightAt: (x, y) => at(height, x, y, 0),
  };
}

/**
 * A Stairs tile's authored dir is whichever neighbor entryClimbDir already
 * finds strictly higher — the generator's own final safety net
 * (demoteOrphanedStairs, cliffs.ts) guarantees every Stairs tile surviving
 * to a finished chunk resolves this non-null, so the `?? 0` fallback below
 * only matters for hand-authored content this function was never run on.
 */
function stairDirAt(view: StairView, x: number, y: number): StackDir {
  return (entryClimbDir(view, x, y) ?? 0) as StackDir;
}

/**
 * Always carries the tile's REAL height explicitly (compile.ts's
 * stair.height override) rather than leaving it for run-interpolation:
 * cliffs.ts's opportunistic single-tile ramps move a fixed slope step from
 * ONE side, not a symmetric split of the total delta, which a generic
 * "average of anchors" formula cannot always reproduce
 * (stacksRoundtrip.test.ts's 25+-seed byte-identical invariant is what
 * caught this). Interpolation stays available for the editor's fresh,
 * height-less paintStairsAt authoring only.
 */
function tileToStack(tile: TileType, h: number, view: StairView, x: number, y: number): StackTile {
  const feature = TILE_FEATURE.get(tile);
  if (feature) return { walls: h, cap: null, stair: null, feature };
  if (tile === TILE.Stairs) return { walls: h, cap: null, stair: { dir: stairDirAt(view, x, y), height: h } };
  if (tile === TILE.Wall) return { walls: h, cap: null, stair: null };
  return { walls: h, cap: DEFAULT_FLOOR_CAP, stair: null };
}

/** Mechanical reverse mapping: floor at h -> walls=h+cap, Wall at h -> walls=h no cap, stairs -> stair tiles. */
export function heightFieldToStacks(
  tiles: Uint8Array,
  height: Float32Array,
  width: number,
  rows: number,
): StackTile[] {
  const view = stairView(tiles, height, width, rows);
  const stacks: StackTile[] = new Array(width * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      stacks[i] = tileToStack(tiles[i] as TileType, height[i] ?? 0, view, x, y);
    }
  }
  return stacks;
}
