import { entryClimbDir, type StairView } from "@dc2d/engine";
import atlas from "./atlas.json";
import { TILE_PX } from "./constants";

/**
 * Placement of the pack's REAL staircase objects (stair-ns/e/w.png,
 * baked from TX Struct) over single-step entries — pure geometry, so
 * the live client (terrain.ts) and tools/render-sample.ts stamp
 * pixel-identical staircases.
 *
 * A "single-step entry" is a stair tile whose climb axis reads high
 * ground on one side and low ground on the other, one walkable step
 * each way, with neither neighbor more stairs — i.e. terrace entries
 * and authored one-step connections, NOT long multi-tile ramps (those
 * keep their tread tiles). One object per contiguous entry run,
 * centered, like the pack's own sample map:
 *
 *   climb N — the classic south-face staircase (2×3 tiles): its top
 *             row overlays the platform's FACE row (the rim tile
 *             draws its cliff face in its own cell), base on the floor
 *   climb E/W — the full wedge objects (slanted rails), entirely on
 *             the low ground, tall edge flush against the platform
 *             boundary (side edges have no face row to overlay)
 *   climb S — no sprite: the face points away from a top-down camera,
 *             so those entries keep the plain tread tiles
 */

export interface StairSpriteSpec {
  key: keyof typeof atlas.stairSprites;
  /** Top-left corner in world pixels. */
  px: number;
  py: number;
  /** Height used for elevation tinting (the entry step's height). */
  tintHeight: number;
}

/**
 * Staircase objects for entries inside a tile rect (a chunk, or a
 * sample-render window). Each contiguous run emits ONE sprite from the
 * tile where the run starts, so neighboring rects never double-stamp.
 */
export function stairSpritesInRect(
  world: StairView,
  x0: number,
  y0: number,
  w: number,
  h: number,
): StairSpriteSpec[] {
  const out: StairSpriteSpec[] = [];
  const S = atlas.stairSprites;
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      const wx = x0 + tx;
      const wy = y0 + ty;
      const d = entryClimbDir(world, wx, wy);
      if (d === null || d === 2) continue;
      const tintHeight = world.heightAt(wx, wy);
      if (d === 0) {
        // Horizontal run along the terrace edge; sprite spans rows
        // (wy-1..wy+1): rim, step, approach floor.
        if (entryClimbDir(world, wx - 1, wy) === 0) continue; // not the run start
        let x1 = wx;
        while (entryClimbDir(world, x1 + 1, wy) === 0) x1++;
        const mid = ((wx + x1 + 1) * TILE_PX) / 2;
        out.push({
          key: "ns",
          px: Math.round(mid - S.ns.w / 2),
          py: (wy - 1) * TILE_PX,
          tintHeight,
        });
      } else {
        // Vertical run; the wedge sits entirely on the LOW side, tall
        // edge flush against the platform boundary (E/W edges have no
        // face row — overlapping the high tile reads as a staircase
        // sunk INTO the platform top). Skirt trails onto the approach.
        if (entryClimbDir(world, wx, wy - 1) === d) continue;
        let y1 = wy;
        while (entryClimbDir(world, wx, y1 + 1) === d) y1++;
        const mid = ((wy + y1 + 1) * TILE_PX) / 2;
        const py = Math.round(mid - S.e.h / 2);
        if (d === 1) {
          out.push({ key: "e", px: (wx + 1) * TILE_PX - S.e.w, py, tintHeight });
        } else {
          out.push({ key: "w", px: wx * TILE_PX, py, tintHeight });
        }
      }
    }
  }
  return out;
}
