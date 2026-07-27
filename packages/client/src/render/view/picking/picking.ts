// Click-picking under the elevation shift (docs/ELEVATION-PROJECTION.md section 4):
// a screen point may show a tall-far tile's shifted cap instead of the flat cell that
// would occupy that slot at height 0. A screen row `vy` displays a cell of height `h`
// exactly when that cell's own (unshifted) view row is `vy + h` — the cap shift moves
// its home row screen-UP by `h` (see viewTransform.ts/ELEVATION-PROJECTION.md section 1)
// — so recovering the real world cell means searching height candidates tallest-first
// and accepting the first whose own recorded height matches the candidate.
//
// Shared by game aim (`input/pointer.ts` cursorWorldTile) and the editor's render-panel
// picker so the two never drift.
import { viewTileToWorld } from "../transform/viewTransform.js";
import type { ViewOrientation } from "../orientation/viewOrientation.js";

/**
 * Search bounds for candidate heights. It remains local to preserve the renderer's
 * one-way dependency direction.
 */
const MAX_PICK_HEIGHT = 16;
const MIN_PICK_HEIGHT = -MAX_PICK_HEIGHT;

export interface TallestFirstPick {
  /** The resolved world tile. */
  readonly wx: number;
  readonly wy: number;
  /** That tile's real height (0 for the flat fallback — byte-identical to pre-E3 picking). */
  readonly height: number;
}

export interface TallestFirstPickRequest {
  readonly vx: number;
  readonly vy: number;
  readonly orientation: ViewOrientation;
  readonly heightAt: (wx: number, wy: number) => number;
}

/**
 * Resolves the world tile a pointer over view cell (`vx`, `vy`) is really looking at:
 * for `h` from `MAX_PICK_HEIGHT` down through negative pit depths, the candidate is the world tile that would
 * display, unshifted, at view row `vy + h` — accept the first whose own `heightAt`
 * equals `h`. Zero is tested before negative heights, so a flat cap still occludes a
 * below-base cap. Falls back to the raw `h = 0` cell when no projected cap claims the
 * slot. `vx`/`vy` are integer view-tile indices (already floored by the caller).
 */
type LegacyTallestFirstPickArgs = [number, number, ViewOrientation, (wx: number, wy: number) => number];

export function pickTallestFirst(...args: [TallestFirstPickRequest] | LegacyTallestFirstPickArgs): TallestFirstPick {
  const { vx, vy, orientation, heightAt } = normalizeTallestFirstPickRequest(args);
  for (let h = MAX_PICK_HEIGHT; h >= MIN_PICK_HEIGHT; h--) {
    const world = viewTileToWorld({ x: vx, y: vy + h }, orientation);
    if (heightAt(world.x, world.y) === h) return { wx: world.x, wy: world.y, height: h };
  }
  const flat = viewTileToWorld({ x: vx, y: vy }, orientation);
  return { wx: flat.x, wy: flat.y, height: 0 };
}

function normalizeTallestFirstPickRequest(args: [TallestFirstPickRequest] | LegacyTallestFirstPickArgs): TallestFirstPickRequest {
  const [first] = args;
  if (typeof first === "object") return first;
  const [vx, vy, orientation, heightAt] = args as LegacyTallestFirstPickArgs;
  return { vx, vy, orientation, heightAt };
}
