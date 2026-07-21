// LANE W stairs wayfinding (panel R3 blocker #2 — BookFan couldn't find the floor-1
// stairway in 90 instrumented minutes): resolves the compass dial's gold StairwayDown
// tick from the same deterministic stairwayDownPosition seam stairwayProximity.ts and
// the server's own descend gate already share — the client needs no new protocol data.
//
// Bearing composition: world bearing to the stairway is measured compass-style
// (0 = world-north = -y, clockwise-positive, east = +x = 90), then rotated by the
// SAME live view bearing the letter dial uses (compassBearing.ts, continuous through
// the Q/X tween) — so the tick stays glued to the true screen direction mid-rotation
// by construction, exactly like the cardinal letters.
import { stairwayDownPosition } from "@dc2d/engine";
import { wrapDegrees } from "../../render/view/index.js";
import type { StairwayTickData } from "../../ui/widgets/hud/fakeData.js";
import type { StairwayWorld } from "./stairwayProximity.js";

/** Distance (tiles, straight-line) inside which the tick pulses — "you're close". */
export const STAIRWAY_NEAR_TILES = 8;

/**
 * The gold tick's screen bearing + proximity pulse flag for a player at world
 * (x, y), or null when this floor has no StairwayDown (FLOOR_CAP's boss arena).
 * `viewBearingDeg` is compassBearingDeg's output: the screen bearing world-north
 * currently renders at (0 = north-up), clockwise-positive.
 */
export function resolveStairwayTick(
  world: StairwayWorld,
  x: number,
  y: number,
  viewBearingDeg: number,
): StairwayTickData | null {
  const target = stairwayDownPosition(world);
  if (!target) return null;
  const dx = target.x - x;
  const dy = target.y - y;
  // atan2(east, north): 0 at due north (-y), 90 at due east (+x) — compass convention.
  const worldBearingDeg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return {
    screenBearingDeg: wrapDegrees(viewBearingDeg + worldBearingDeg),
    near: Math.hypot(dx, dy) <= STAIRWAY_NEAR_TILES,
  };
}
