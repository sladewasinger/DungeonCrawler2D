// Remaps the engine's real-world stair climb direction (stairs.ts's DIRS: 0=N, 1=E, 2=S,
// 3=W — a physical height-gradient fact, so stairVisualAt itself must always be queried
// against the REAL world, never the view-space proxy) into the SCREEN-relative direction
// index stairTread.ts's stacksVertically/highEndAtStart/treadRisers already expect. Those
// functions never cared whether their `direction` was a world or screen compass — they
// only ever branch on index 0/2 vs 1/3 — so handing them a screen-relative index instead
// of the raw world one is the entire fix for "stair treads stay perpendicular to the
// SCREEN climb direction" (the seam's own stairTreadAxis oracle, cross-checked in this
// file's test): no changes needed to stairTread.ts, drawStairTread.ts, or debugArt.ts's
// pickStairFrame at all.
import { screenSlotFor, type CompassDir } from "../view/directionRemap.js";
import type { ViewOrientation } from "../view/viewOrientation.js";

/** stairs.ts's own DIRS order — index-compatible with directionRemap's compass cycle. */
const WORLD_COMPASS: readonly CompassDir[] = ["N", "E", "S", "W"];

/** The screen-relative direction index for a real-world climb direction at `orientation`. */
export function screenClimbDirIndex(worldDirection: number, orientation: ViewOrientation): number {
  const worldDir = WORLD_COMPASS[worldDirection];
  if (!worldDir) return worldDirection;
  const screenSlot = screenSlotFor(worldDir, orientation);
  return WORLD_COMPASS.indexOf(screenSlot);
}
