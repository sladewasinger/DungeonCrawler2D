import { z } from "zod";
import { CHUNK_SIZE, TILE } from "../types";

/**
 * Custom map stamps — hand-authored maps from the Tile Studio editor
 * (tools/tile-studio/), plopped over generated terrain for testing.
 *
 * A map carries two grids:
 *   - `logic`: engine TILE ids (walls, floors, doors…) — collision and
 *     interaction truth, stamped into generation on BOTH server and
 *     client (set the same file on both sides, or they desync).
 *   - `art`: raw pack-sheet tile indices (row-major index into the
 *     sheet grid) — the client draws these verbatim on a dedicated
 *     tilemap layer above the autotiled terrain. The engine ignores it.
 *
 * The stamp flattens height inside its rectangle (flattenTo, default 0)
 * so authored geometry is walkable regardless of the terrain beneath.
 */

const gridCell = z.union([z.number().int().min(0), z.null()]);

export const customMapSchema = z.object({
  format: z.literal("dc2d-map"),
  version: z.literal(1),
  /** Source-sheet metadata (informational for the game, vital for the editor). */
  tileSize: z.number().int().positive(),
  sheet: z.string(),
  sheetCols: z.number().int().positive(),
  origin: z.object({ x: z.number().int(), y: z.number().int() }),
  width: z.number().int().min(1).max(256),
  height: z.number().int().min(1).max(256),
  /** Engine TILE ids, row-major, null = keep generated tile. */
  logic: z.array(z.union([z.number().int().min(0).max(8), z.null()])),
  /** Pack-sheet tile indices, row-major, null = no art override. */
  art: z.array(gridCell).optional(),
  /** Second art layer drawn OVER `art` (objects/walls on their ground). */
  art2: z.array(gridCell).optional(),
  flattenTo: z.number().optional(),
});
export type CustomMapDef = z.infer<typeof customMapSchema>;

let active: CustomMapDef | null = null;

/** Install (or clear) the custom map used by chunk generation. */
export function setCustomMap(def: CustomMapDef | null): void {
  if (def !== null) {
    const cells = def.width * def.height;
    if (
      def.logic.length !== cells ||
      (def.art !== undefined && def.art.length !== cells) ||
      (def.art2 !== undefined && def.art2.length !== cells)
    ) {
      throw new Error(`custom map grids must have width*height (${cells}) entries`);
    }
  }
  active = def;
}

export function getCustomMap(): CustomMapDef | null {
  return active;
}

/** Art override at a world tile, or null (client rendering). */
export function customArtAt(wx: number, wy: number): number | null {
  if (!active?.art) return null;
  const lx = wx - active.origin.x;
  const ly = wy - active.origin.y;
  if (lx < 0 || ly < 0 || lx >= active.width || ly >= active.height) return null;
  return active.art[ly * active.width + lx] ?? null;
}

/** Top-layer art override (drawn over `art`), or null. */
export function customArt2At(wx: number, wy: number): number | null {
  if (!active?.art2) return null;
  const lx = wx - active.origin.x;
  const ly = wy - active.origin.y;
  if (lx < 0 || ly < 0 || lx >= active.width || ly >= active.height) return null;
  return active.art2[ly * active.width + lx] ?? null;
}

/**
 * Stamp the active map over a generated chunk (after the test zone).
 * Stamped walkable cells are marked in `reachSeeds` so the pocket
 * sealer never fills an authored room back in.
 */
export function applyCustomMap(
  cx: number,
  cy: number,
  tiles: Uint8Array,
  height: Float32Array,
  reachSeeds?: Uint8Array,
): void {
  if (!active) return;
  const baseX = cx * CHUNK_SIZE;
  const baseY = cy * CHUNK_SIZE;
  const x0 = Math.max(0, active.origin.x - baseX);
  const y0 = Math.max(0, active.origin.y - baseY);
  const x1 = Math.min(CHUNK_SIZE, active.origin.x + active.width - baseX);
  const y1 = Math.min(CHUNK_SIZE, active.origin.y + active.height - baseY);
  if (x0 >= x1 || y0 >= y1) return;

  const flat = active.flattenTo ?? 0;
  for (let ly = y0; ly < y1; ly++) {
    for (let lx = x0; lx < x1; lx++) {
      const mx = baseX + lx - active.origin.x;
      const my = baseY + ly - active.origin.y;
      const i = ly * CHUNK_SIZE + lx;
      height[i] = flat;
      const logic = active.logic[my * active.width + mx];
      if (logic !== null && logic !== undefined) tiles[i] = logic;
      else if (tiles[i] === TILE.Wall) tiles[i] = TILE.Floor; // clear the canvas
      if (reachSeeds && tiles[i] !== TILE.Wall) reachSeeds[i] = 1;
    }
  }
}
