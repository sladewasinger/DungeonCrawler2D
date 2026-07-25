import { INTERACT_RANGE, stairwayDownPosition } from "@dc2d/engine";
import { FLOOR_CAP } from "../floors/constants.js";
import type { PlayerSlot, SimState } from "../state.js";

/**
 * The `descend` intent (Epic 7.14, WIRE v15): valid within interact
 * range of the down stairway on the player's current floor. Descent is
 * one-way: the arrival stairway on the next floor never accepts this
 * intent. Out of range: a toast, no-op.
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
  slot.outbox.push({ t: "toast", msg: "No stairway in reach." });
}

function withinRange(body: { x: number; y: number }, target: { x: number; y: number }): boolean {
  return Math.hypot(target.x - body.x, target.y - body.y) <= INTERACT_RANGE;
}
