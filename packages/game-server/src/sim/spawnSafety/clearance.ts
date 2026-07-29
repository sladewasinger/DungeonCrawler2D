import { SPAWN_CLEARANCE_RADIUS } from "./constants.js";

/** Whether a point is strictly inside any protected spawn-clearance radius. */
export function insideGracedClearance(
  centers: ReadonlyArray<{ x: number; y: number }>,
  x: number,
  y: number,
): boolean {
  return centers.some((center) => Math.hypot(center.x - x, center.y - y) < SPAWN_CLEARANCE_RADIUS);
}
