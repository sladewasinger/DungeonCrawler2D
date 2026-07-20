// Keeps ordinary BSP room height variants (pit/dais/chasm) away from a
// landmark's footprint: a room only partially inside the landmark's reach
// would otherwise carry its own +/-2 (or -4) ring right up against the
// landmark's flat floor with no doorway to carry a proper ramp — cliffs.ts's
// general sweep would then repair that raw boundary into a much wider
// staircase patch than any deliberate feature should read as. Forcing
// nearby rooms flat means the landmark's own (already-graduated) height
// meets ordinary ground with nothing more than the usual WALL_RISE step.

import { bossArenaGuardAnchor } from "../../features/bossArena.js";
import { descentGuardAnchor } from "../../features/descent.js";
import { isSafeRoomChunk, isStairsChunk } from "../../features/fixed.js";
import type { Rect } from "../types.js";
import { isLandmarkChunk } from "../district.js";
import { landmarkCenter } from "./shared.js";

// Covers every landmark kind's own reach (arena's WALL_RADIUS = 10 is the
// largest) plus a margin, without needing to plumb each kind's constant here.
const GUARD_REACH = 12;

function chebyshevDistance(rect: Rect, cx: number, cy: number): number {
  const dx = Math.max(rect.x0 - cx, 0, cx - rect.x1);
  const dy = Math.max(rect.y0 - cy, 0, cy - rect.y1);
  return Math.max(dx, dy);
}

export function isNearLandmark(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
  rect: Rect,
): boolean {
  if (!isLandmarkChunk(cx, cy)) return false;
  if (isSafeRoomChunk(worldSeed, floor, cx, cy)) return false;
  if (isStairsChunk(worldSeed, floor, cx, cy)) return false;
  const center = landmarkCenter(worldSeed, floor, cx, cy);
  return chebyshevDistance(rect, center.lx, center.ly) <= GUARD_REACH;
}

/** Same guard as isNearLandmark, for the single-per-floor descent structures (features/descent.ts, features/bossArena.ts) — whichever (if any) claimed this chunk. */
export function isNearDescent(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
  rect: Rect,
): boolean {
  const anchor =
    descentGuardAnchor(worldSeed, floor, cx, cy) ?? bossArenaGuardAnchor(worldSeed, floor, cx, cy);
  if (!anchor) return false;
  return chebyshevDistance(rect, anchor.lx, anchor.ly) <= anchor.reach;
}
