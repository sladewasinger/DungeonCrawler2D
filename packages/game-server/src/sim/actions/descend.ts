import { INTERACT_RANGE, stairwayDownPosition, stairwayUpPosition } from "@dc2d/engine";
import { FLOOR_CAP } from "../floors/constants.js";
import type { PlayerSlot, SimState } from "../state.js";

/**
 * The `descend` intent (Epic 7.14, WIRE v15): valid within interact
 * range of EITHER stairway on the player's current floor — near the
 * down-mouth descends to floor+1's up-stair, near the up-mouth ascends
 * to floor-1's down-stair (symmetric). Out of range of both: a toast,
 * no-op.
 */
export function doDescend(sim: SimState, slot: PlayerSlot): void {
  if (slot.pendingTransfer) return;
  const body = slot.entity.body;
  const floor = sim.world.floor;

  if (floor < FLOOR_CAP) {
    const down = stairwayDownPosition(sim.world);
    if (down && withinRange(body, down)) {
      slot.pendingTransfer = { targetFloor: floor + 1, arrival: "stairUp" };
      return;
    }
  }
  if (floor > 1) {
    const up = stairwayUpPosition(sim.world);
    if (up && withinRange(body, up)) {
      slot.pendingTransfer = { targetFloor: floor - 1, arrival: "stairDown" };
      return;
    }
  }
  slot.outbox.push({ t: "toast", msg: "No stairway in reach." });
}

function withinRange(body: { x: number; y: number }, target: { x: number; y: number }): boolean {
  return Math.hypot(target.x - body.x, target.y - body.y) <= INTERACT_RANGE;
}
