import { INTERACT_RANGE } from "@dc2d/engine";
import { FLOOR_CAP } from "../floors/constants.js";
import type { PlayerSlot, SimState } from "../state/state.js";

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
    const down = nearestDownStairway(sim, body);
    if (down) {
      slot.pendingTransfer = { targetFloor: floor + 1, arrival: "stairUp" };
      slot.outbox.push({ t: "floorTransition", floor: floor + 1 });
      return;
    }
  }
  slot.outbox.push({ t: "toast", msg: "No stairway in reach." });
}

function nearestDownStairway(
  sim: SimState,
  body: { readonly x: number; readonly y: number },
): { readonly x: number; readonly y: number } | null {
  return sim.world.downStairwayPositions()
    .map((target) => ({ target, distance: Math.hypot(target.x - body.x, target.y - body.y) }))
    .filter(({ distance }) => distance <= INTERACT_RANGE)
    .sort((left, right) => left.distance - right.distance)[0]?.target ?? null;
}
