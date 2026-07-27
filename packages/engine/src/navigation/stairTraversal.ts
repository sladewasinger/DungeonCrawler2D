import { STEP_UP } from "../core/constants.js";
import type { WorldView } from "../world/types.js";

const STAIR_RIM_PROBE = 0.01;

/** Match movement's side-rim gate when evaluating a path edge. */
export function stairRimBlocks(
  world: WorldView,
  fromX: number,
  fromY: number,
  dx: number,
  dy: number,
): boolean {
  const sign = Math.sign(dx !== 0 ? dx : dy);
  const axisBoundary = dx !== 0 ? (sign > 0 ? fromX + 1 : fromX) :
    (sign > 0 ? fromY + 1 : fromY);
  const nearAxis = axisBoundary - sign * STAIR_RIM_PROBE;
  const farAxis = axisBoundary + sign * STAIR_RIM_PROBE;
  const near = dx !== 0
    ? world.groundAt(nearAxis, fromY + 0.5)
    : world.groundAt(fromX + 0.5, nearAxis);
  const far = dx !== 0
    ? world.groundAt(farAxis, fromY + 0.5)
    : world.groundAt(fromX + 0.5, farAxis);
  return far - near > STEP_UP;
}
