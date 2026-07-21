// Click-picking under the elevation shift (docs/ELEVATION-PROJECTION.md section 4):
// a screen point may show a tall-far tile's shifted cap instead of the flat cell that
// would occupy that slot at height 0. A screen row `vy` displays a cell of height `h`
// exactly when that cell's own (unshifted) view row is `vy + h` — the cap shift moves
// its home row screen-UP by `h` (see viewTransform.ts/ELEVATION-PROJECTION.md section 1)
// — so recovering the real world cell means searching height candidates tallest-first
// and accepting the first whose own recorded height matches the candidate.
//
// Shared by game aim (`input/pointer.ts` cursorWorldTile) and the editor's render-panel
// picker (`scenes/editor/renderPanelPointer.ts` hoveredCellAt) so the two never drift.
import { viewTileToWorld } from "./viewTransform.js";
import type { ViewOrientation } from "./viewOrientation.js";

/**
 * Search ceiling for candidate heights: mirrors `render/terrain/ownFace.ts`'s
 * `MAX_FACE_ROWS` (not imported directly — `render/view` is a lower layer than
 * `render/terrain`, which itself depends on `render/view`, and importing "up" would
 * invert that direction; see docs/ASSUMPTIONS.md row 320). No drawn cap climbs higher
 * than that budget, so no real cell's height can exceed it either.
 */
const MAX_PICK_HEIGHT = 16;

export interface TallestFirstPick {
  /** The resolved world tile. */
  readonly wx: number;
  readonly wy: number;
  /** That tile's real height (0 for the flat fallback — byte-identical to pre-E3 picking). */
  readonly height: number;
}

/**
 * Resolves the world tile a pointer over view cell (`vx`, `vy`) is really looking at:
 * for `h` from `MAX_PICK_HEIGHT` down to 1, the candidate is the world tile that would
 * display, unshifted, at view row `vy + h` — accept the first whose own `heightAt`
 * equals `h`. Falls back to the flat `h = 0` cell (today's behavior) when nothing
 * taller claims the slot. `vx`/`vy` are integer view-tile indices (already floored by
 * the caller), matching `viewTileToWorld`'s own tile-index convention.
 */
export function pickTallestFirst(
  vx: number,
  vy: number,
  orientation: ViewOrientation,
  heightAt: (wx: number, wy: number) => number,
): TallestFirstPick {
  for (let h = MAX_PICK_HEIGHT; h >= 1; h--) {
    const world = viewTileToWorld({ x: vx, y: vy + h }, orientation);
    if (heightAt(world.x, world.y) === h) return { wx: world.x, wy: world.y, height: h };
  }
  const flat = viewTileToWorld({ x: vx, y: vy }, orientation);
  return { wx: flat.x, wy: flat.y, height: 0 };
}
